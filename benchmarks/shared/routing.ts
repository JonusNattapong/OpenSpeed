export interface RouteConfig {
  method: string;
  path: string;
  response: {
    type: 'text' | 'json';
    data: any;
  };
}

// Transform path for Hono regex syntax
export function transformPathForHono(path: string): string {
  return path.replace(/:(\w+)\(([^)]+)\)/g, ':$1{$2}');
}

export const routingConfig: RouteConfig[] = [
  {
    method: 'get',
    path: '/health',
    response: {
      type: 'json',
      data: { status: 'ok', framework: 'openspeed', scenario: 'routing' },
    },
  },
  {
    method: 'get',
    path: '/',
    response: {
      type: 'text',
      data: 'Hello World',
    },
  },
  {
    method: 'get',
    path: '/user/:id',
    response: {
      type: 'json',
      data: { userId: '{{params.id}}', name: 'User {{params.id}}' },
    },
  },
  {
    method: 'get',
    path: '/api/v1/users/:userId/posts/:postId',
    response: {
      type: 'json',
      data: {
        userId: '{{params.userId}}',
        postId: '{{params.postId}}',
        title: 'Post {{params.postId}} by User {{params.userId}}',
        content: 'This is a sample post content for benchmarking purposes.',
      },
    },
  },
  {
    method: 'post',
    path: '/api/data',
    response: {
      type: 'json',
      data: { received: true, method: 'POST' },
    },
  },
  {
    method: 'put',
    path: '/api/users/:id',
    response: {
      type: 'json',
      data: { updated: true, userId: '{{params.id}}' },
    },
  },
  {
    method: 'delete',
    path: '/api/users/:id',
    response: {
      type: 'json',
      data: { deleted: true, userId: '{{params.id}}' },
    },
  },
  {
    method: 'get',
    path: '/api/v2/status',
    response: {
      type: 'json',
      data: { api: 'v2', status: 'active' },
    },
  },
  {
    method: 'get',
    path: '/api/v2/metrics',
    response: {
      type: 'json',
      data: {
        requests: 1000,
        errors: 0,
        avgResponseTime: 15,
      },
    },
  },
  {
    method: 'get',
    path: '/search',
    response: {
      type: 'json',
      data: {
        query: '{{query.q}}',
        limit: '{{query.limit}}',
        offset: '{{query.offset}}',
        results: '{{searchResults}}',
      },
    },
  },
  {
    method: 'get',
    path: '/files/:filename',
    response: {
      type: 'json',
      data: {
        filename: '{{params.filename}}',
        size: '{{randomSize}}',
        type: '{{filenameExt}}',
      },
    },
  },
  {
    method: 'get',
    path: '/assets/*',
    response: {
      type: 'json',
      data: {
        path: '{{params.*}}',
        served: true,
        contentType: '{{contentType}}',
      },
    },
  },
];

// Helper functions for dynamic data
export function generateSearchResults(q: string, limit: number, offset: number) {
  return Array.from({ length: Math.min(limit, 100) }, (_, i) => ({
    id: offset + i + 1,
    title: `Result ${offset + i + 1} for "${q}"`,
    score: Math.random(),
  }));
}

export function getRandomSize() {
  return Math.floor(Math.random() * 1000000);
}

export function getFilenameExt(filename: string) {
  return filename.split('.').pop();
}

export function getContentType(path: string) {
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.css')) return 'text/css';
  return 'text/plain';
}

// Template function to replace placeholders in response data
export function templateResponse(
  data: any,
  context: { params?: any; query?: any; [key: string]: any }
): any {
  if (typeof data === 'string') {
    return data
      .replace(/\{\{(\w+)\.(\w+)\}\}/g, (match, obj, prop) => {
        if (obj === 'params' && context.params && context.params[prop] !== undefined) {
          return context.params[prop];
        }
        if (obj === 'query' && context.query && context.query[prop] !== undefined) {
          return context.query[prop];
        }
        if (context[obj] && context[obj][prop] !== undefined) {
          return context[obj][prop];
        }
        return match;
      })
      .replace(/\{\{(\w+)\}\}/g, (match, key) => {
        if (context[key] !== undefined) {
          return context[key];
        }
        return match;
      });
  }
  if (Array.isArray(data)) {
    return data.map((item) => templateResponse(item, context));
  }
  if (typeof data === 'object' && data !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'results' && value === '{{searchResults}}') {
        const q = context.query?.q || '';
        const limit = parseInt(context.query?.limit || '10');
        const offset = parseInt(context.query?.offset || '0');
        result[key] = generateSearchResults(q, limit, offset);
      } else if (key === 'size' && value === '{{randomSize}}') {
        result[key] = getRandomSize();
      } else if (key === 'type' && value === '{{filenameExt}}') {
        result[key] = getFilenameExt(context.params?.filename || '');
      } else if (key === 'contentType' && value === '{{contentType}}') {
        result[key] = getContentType(context.params?.['*'] || '');
      } else {
        result[key] = templateResponse(value, context);
      }
    }
    return result;
  }
  return data;
}

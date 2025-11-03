import type { Context } from '../context.js';
import type { ZodSchema } from 'zod';

interface RouteInfo {
  method: string;
  path: string;
  description?: string;
  requestBody?: ZodSchema;
  responses?: Record<string, { schema?: ZodSchema; description?: string }>;
  parameters?: Array<{
    name: string;
    in: 'path' | 'query' | 'header';
    required?: boolean;
    schema: ZodSchema;
    description?: string;
  }>;
}

export function openapi(options: { title?: string; version?: string } = {}) {
  const routes: RouteInfo[] = [];
  const { title = 'OpenSpeed API', version = '1.0.0' } = options;

  const api = {
    collect: (method: string, path: string, options: string | Partial<RouteInfo> = {}) => {
      const routeInfo: Partial<RouteInfo> =
        typeof options === 'string' ? { description: options } : options;

      routes.push({
        method: method.toLowerCase(),
        path,
        ...routeInfo,
      });
    },
    generate: () => {
      const paths: Record<string, any> = {};

      for (const route of routes) {
        const path = route.path.replace(/:(\w+)/g, '{$1}');
        if (!paths[path]) paths[path] = {};

        const operation: any = {
          description: route.description || '',
          responses: {},
        };

        // Add parameters
        if (route.parameters) {
          operation.parameters = route.parameters.map((param) => ({
            name: param.name,
            in: param.in,
            required: param.required,
            description: param.description,
            schema: zodToOpenAPISchema(param.schema),
          }));
        }

        // Add path parameters from route
        const pathParams = route.path.match(/:(\w+)/g);
        if (pathParams) {
          operation.parameters = operation.parameters || [];
          for (const param of pathParams) {
            const name = param.slice(1);
            if (!operation.parameters.find((p: any) => p.name === name && p.in === 'path')) {
              operation.parameters.push({
                name,
                in: 'path',
                required: true,
                schema: { type: 'string' },
              });
            }
          }
        }

        // Add request body
        if (route.requestBody && ['post', 'put', 'patch'].includes(route.method)) {
          operation.requestBody = {
            required: true,
            content: {
              'application/json': {
                schema: zodToOpenAPISchema(route.requestBody),
              },
            },
          };
        }

        // Add responses
        if (route.responses) {
          for (const [status, response] of Object.entries(route.responses)) {
            operation.responses[status] = {
              description: response.description || 'Success',
              content: response.schema
                ? {
                    'application/json': {
                      schema: zodToOpenAPISchema(response.schema),
                    },
                  }
                : undefined,
            };
          }
        } else {
          operation.responses['200'] = { description: 'Success' };
        }

        paths[path][route.method] = operation;
      }

      return {
        openapi: '3.0.0',
        info: { title, version },
        paths,
      };
    },
    middleware: async (ctx: Context, next: () => Promise<any>) => {
      // NOTE: localhost URL is only used as base for pathname parsing, not for actual connection
      const pathname = new URL(ctx.req.url, 'http://localhost').pathname;
      if (pathname === '/openapi.json') {
        ctx.res.status = 200;
        ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
        ctx.res.body = JSON.stringify(api.generate(), null, 2);
        return;
      }
      await next();
    },
  };

  return api;
}

// Helper function to convert Zod schema to OpenAPI schema (basic implementation)
function zodToOpenAPISchema(schema: ZodSchema): any {
  // This is a basic implementation. For production, consider using a library like zod-to-openapi
  try {
    const shape = (schema as any)._def.shape?.();
    if (shape) {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, fieldSchema] of Object.entries(shape)) {
        properties[key] = zodToOpenAPISchema(fieldSchema as ZodSchema);
        if (!(fieldSchema as any)._def.optional) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    const typeName = (schema as any)._def.typeName;
    switch (typeName) {
      case 'ZodString':
        return { type: 'string' };
      case 'ZodNumber':
        return { type: 'number' };
      case 'ZodBoolean':
        return { type: 'boolean' };
      case 'ZodArray':
        return {
          type: 'array',
          items: zodToOpenAPISchema((schema as any)._def.element),
        };
      default:
        return { type: 'string' }; // fallback
    }
  } catch {
    return { type: 'string' };
  }
}

export interface JsonRouteConfig {
  method: string;
  path: string;
  response: (
    body?: any,
    query?: any
  ) => {
    type: 'json';
    data: any;
    status?: number;
  };
}

export const jsonConfig: JsonRouteConfig[] = [
  // health
  {
    method: 'get',
    path: '/health',
    response: () => ({
      type: 'json',
      data: { status: 'ok', framework: 'openspeed', scenario: 'json' },
    }),
  },
  // json
  {
    method: 'post',
    path: '/json',
    response: (body) => ({
      type: 'json',
      data: {
        received: body,
        timestamp: new Date().toISOString(),
        processed: true,
        length: JSON.stringify(body).length,
        keys: Object.keys(body),
        nested: body.data
          ? {
              arrayLength: Array.isArray(body.data) ? body.data.length : 0,
              hasNumbers: Array.isArray(body.data)
                ? body.data.some((x: any) => typeof x === 'number')
                : false,
            }
          : null,
      },
    }),
  },
  // json-response
  {
    method: 'get',
    path: '/json-response',
    response: (body, query) => {
      const size = parseInt(query?.size || '1000');
      return {
        type: 'json',
        data: {
          id: Math.random().toString(36),
          timestamp: new Date().toISOString(),
          metadata: {
            version: '1.0',
            framework: 'openspeed',
            scenario: 'json',
          },
          items: Array.from({ length: size }, (_, i) => ({
            id: i + 1,
            name: `Item ${i + 1}`,
            value: Math.random() * 1000,
            category: ['A', 'B', 'C'][i % 3],
            tags: ['tag1', 'tag2', 'tag3'].slice(0, (i % 3) + 1),
            nested: {
              subId: i * 10,
              subValue: Math.random(),
              subArray: [i, i + 1, i + 2],
            },
          })),
          summary: {
            totalItems: size,
            totalValue: 0,
            categories: ['A', 'B', 'C'],
            generatedAt: new Date().toISOString(),
          },
        },
      };
    },
  },
  // json-stream
  {
    method: 'get',
    path: '/json-stream',
    response: (body, query) => {
      const chunks = parseInt(query?.chunks || '10');
      const chunkSize = parseInt(query?.chunkSize || '100');
      const result: Array<{ chunk: number; data: Array<{ id: number; value: number }> }> = [];
      for (let i = 0; i < chunks; i++) {
        result.push({
          chunk: i + 1,
          data: Array.from({ length: chunkSize }, (_, j) => ({
            id: i * chunkSize + j,
            value: Math.random(),
          })),
        });
      }
      return {
        type: 'json',
        data: {
          totalChunks: chunks,
          chunkSize,
          data: result,
          totalItems: chunks * chunkSize,
        },
      };
    },
  },
  // json-transform
  {
    method: 'post',
    path: '/json-transform',
    response: (body) => {
      if (!body || !Array.isArray(body.items)) {
        return {
          type: 'json',
          data: { error: 'Expected { items: [...] }' },
          status: 400,
        };
      }
      const transformed = body.items.map((item: any, index: number) => ({
        originalId: item.id,
        newId: `transformed_${index + 1}`,
        name: item.name?.toUpperCase() || 'UNKNOWN',
        value: typeof item.value === 'number' ? item.value * 1.1 : 0,
        category: item.category || 'default',
        tags: item.tags?.map((tag: string) => tag.toLowerCase()) || [],
        computed: {
          isHighValue: (item.value || 0) > 500,
          nameLength: item.name?.length || 0,
          tagCount: item.tags?.length || 0,
        },
        metadata: {
          transformedAt: new Date().toISOString(),
          transformer: 'openspeed-json-benchmark',
        },
      }));
      return {
        type: 'json',
        data: {
          originalCount: body.items.length,
          transformedCount: transformed.length,
          data: transformed,
          processing: {
            time: Date.now(),
            version: '1.0',
          },
        },
      };
    },
  },
  // json-validate
  {
    method: 'post',
    path: '/json-validate',
    response: (body) => {
      const validation = {
        isObject: typeof body === 'object' && body !== null,
        hasRequiredFields: body && 'id' in body && 'data' in body,
        dataIsArray: body?.data && Array.isArray(body.data),
        dataLength: body?.data?.length || 0,
        allItemsValid:
          body?.data?.every(
            (item: any) => item && typeof item === 'object' && 'id' in item && 'value' in item
          ) || false,
        validationTime: Date.now(),
      };
      if (!validation.isObject || !validation.hasRequiredFields) {
        return {
          type: 'json',
          data: {
            valid: false,
            errors: ['Missing required fields'],
            validation,
          },
          status: 400,
        };
      }
      return {
        type: 'json',
        data: {
          valid: true,
          validation,
          data: body,
        },
      };
    },
  },
];

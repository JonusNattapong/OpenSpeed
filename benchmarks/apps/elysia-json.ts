import { Elysia } from 'elysia';

const app = new Elysia();

// Health check
app.get('/health', () => {
  return {
    status: 'ok',
    framework: 'elysia',
    scenario: 'json'
  };
});

// JSON parsing benchmark
app.post('/json', async ({ body }) => {
  // Simple validation
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid JSON' };
  }

  // Process the data
  const processed = {
    received: body,
    timestamp: new Date().toISOString(),
    processed: true,
    length: JSON.stringify(body).length,
    keys: Object.keys(body),
    nested: body.data ? {
      arrayLength: Array.isArray(body.data) ? body.data.length : 0,
      hasNumbers: Array.isArray(body.data) ? body.data.some((x: any) => typeof x === 'number') : false,
    } : null
  };

  return processed;
});

// JSON response benchmark
app.get('/json-response', ({ query }) => {
  const size = parseInt(query.size || '1000');

  // Generate large JSON response
  const data = {
    id: Math.random().toString(36),
    timestamp: new Date().toISOString(),
    metadata: {
      version: '1.0',
      framework: 'elysia',
      scenario: 'json'
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
        subArray: [i, i + 1, i + 2]
      }
    })),
    summary: {
      totalItems: size,
      totalValue: 0, // Would calculate in real app
      categories: ['A', 'B', 'C'],
      generatedAt: new Date().toISOString()
    }
  };

  return data;
});

// JSON streaming (simulated)
app.get('/json-stream', ({ query }) => {
  const chunks = parseInt(query.chunks || '10');
  const chunkSize = parseInt(query.chunkSize || '100');

  let result = [];
  for (let i = 0; i < chunks; i++) {
    result.push({
      chunk: i + 1,
      data: Array.from({ length: chunkSize }, (_, j) => ({
        id: i * chunkSize + j,
        value: Math.random()
      }))
    });
  }

  return {
    totalChunks: chunks,
    chunkSize,
    data: result,
    totalItems: chunks * chunkSize
  };
});

// JSON transformation benchmark
app.post('/json-transform', async ({ body }) => {
  if (!body || !Array.isArray(body.items)) {
    return { error: 'Expected { items: [...] }' };
  }

  // Transform the data
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
      tagCount: item.tags?.length || 0
    },
    metadata: {
      transformedAt: new Date().toISOString(),
      transformer: 'elysia-json-benchmark'
    }
  }));

  return {
    originalCount: body.items.length,
    transformedCount: transformed.length,
    data: transformed,
    processing: {
      time: Date.now(),
      version: '1.0'
    }
  };
});

// JSON validation benchmark
app.post('/json-validate', async ({ body }) => {
  const validation = {
    isObject: typeof body === 'object' && body !== null,
    hasRequiredFields: body && 'id' in body && 'data' in body,
    dataIsArray: body?.data && Array.isArray(body.data),
    dataLength: body?.data?.length || 0,
    allItemsValid: body?.data?.every((item: any) =>
      item &&
      typeof item === 'object' &&
      'id' in item &&
      'value' in item
    ) || false,
    validationTime: Date.now()
  };

  if (!validation.isObject || !validation.hasRequiredFields) {
    return {
      valid: false,
      errors: ['Missing required fields'],
      validation
    };
  }

  return {
    valid: true,
    validation,
    data: body
  };
});

const port = process.argv[2] || '3201';
export default {
  port,
  fetch: app.fetch,
};
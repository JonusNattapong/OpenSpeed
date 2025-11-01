import { Hono } from 'hono';
import type { HonoRequest } from 'hono';

const app = new Hono();

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', framework: 'hono', scenario: 'json' });
});

// JSON parsing benchmark
app.post('/json', async (c) => {
  const body = await c.req.json();

  // Simple validation
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON' }, 400);
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

  return c.json(processed);
});

// JSON response benchmark
app.get('/json-response', (c) => {
  const size = parseInt(c.req.query('size') || '1000');

  // Generate large JSON response
  const data = {
    id: Math.random().toString(36),
    timestamp: new Date().toISOString(),
    metadata: {
      version: '1.0',
      framework: 'hono',
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

  return c.json(data);
});

// JSON streaming (simulated)
app.get('/json-stream', (c) => {
  const chunks = parseInt(c.req.query('chunks') || '10');
  const chunkSize = parseInt(c.req.query('chunkSize') || '100');

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

  return c.json({
    totalChunks: chunks,
    chunkSize,
    data: result,
    totalItems: chunks * chunkSize
  });
});

// JSON transformation benchmark
app.post('/json-transform', async (c) => {
  const body = await c.req.json();

  if (!body || !Array.isArray(body.items)) {
    return c.json({ error: 'Expected { items: [...] }' }, 400);
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
      transformer: 'hono-json-benchmark'
    }
  }));

  return c.json({
    originalCount: body.items.length,
    transformedCount: transformed.length,
    data: transformed,
    processing: {
      time: Date.now(),
      version: '1.0'
    }
  });
});

// JSON validation benchmark
app.post('/json-validate', async (c) => {
  const body = await c.req.json();

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
    return c.json({
      valid: false,
      errors: ['Missing required fields'],
      validation
    }, 400);
  }

  return c.json({
    valid: true,
    validation,
    data: body
  });
});

const port = process.argv[2] || '3101';
export default {
  port,
  fetch: app.fetch,
};
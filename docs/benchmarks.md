---
layout: default
title: Benchmarks
nav_order: 5
---

# Benchmarks

OpenSpeed is designed for high performance. Here are the latest benchmark results.

## Latest Results (Node.js v23.10.0)

### Throughput

| Framework | Requests/sec | Latency (P99) | Memory Usage |
|-----------|--------------|---------------|--------------|
| OpenSpeed | 3,800       | 45ms         | 85MB        |
| Hono      | 3,200       | 52ms         | 92MB        |
| Elysia    | 2,800       | 61ms         | 98MB        |

### With Adaptive Optimizer

| Framework | Requests/sec | Improvement | Latency Reduction |
|-----------|--------------|-------------|------------------|
| OpenSpeed | 7,000       | +84%       | -49%            |
| Hono      | 3,200       | -          | -               |
| Elysia    | 2,800       | -          | -               |

## Running Benchmarks

To run benchmarks locally:

```bash
npm run benchmark
```

This will run comprehensive benchmarks comparing OpenSpeed with other frameworks.

## Benchmark Details

### Setup

- **Tool**: autocannon
- **Connections**: 100 concurrent
- **Duration**: 10 seconds
- **Endpoint**: Simple JSON response
- **Hardware**: 8 cores, 16GB RAM

### Test Cases

1. **Basic Routing**: Simple GET request
2. **JSON API**: JSON response with data
3. **Parameterized Routes**: Routes with parameters
4. **Middleware**: Requests with middleware
5. **File Upload**: Multipart form data

## Performance Features

### Adaptive Optimization

OpenSpeed includes machine learning algorithms that optimize performance based on usage patterns.

### Memory Management

- Object pooling for reduced GC pressure
- Streaming for large payloads
- Efficient buffer management

### Caching

- Intelligent response caching
- Query result caching
- Static asset optimization

## Real-World Performance

### E-commerce API

- **OpenSpeed**: 6,800 req/s
- **Hono**: 2,500 req/s
- **Elysia**: 2,200 req/s

### Multi-tenant SaaS

- **OpenSpeed**: Built-in tenant isolation
- **Hono/Elysia**: Requires custom implementation

### File Processing

- **OpenSpeed**: Streaming with 95% less memory
- **Traditional**: Full buffer loading

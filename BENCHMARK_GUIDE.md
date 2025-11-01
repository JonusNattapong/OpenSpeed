# OpenSpeed Benchmark Guide

This guide shows you how to benchmark OpenSpeed against Hono and Elysia frameworks.

## Overview

The benchmarks have been refactored to eliminate duplicate code. All frameworks now share common configuration files located in `benchmarks/shared/`:
- `routing.ts` - Route definitions and response templates
- `json.ts` - JSON processing configurations

This ensures consistent testing across all frameworks.

## Quick Start - Manual Testing

### 1. Routing Benchmark

Test each framework individually:

**OpenSpeed:**
```bash
npx tsx benchmarks/apps/openspeed-routing.ts 3000
```

**Hono:**
```bash
npx tsx benchmarks/apps/hono-routing.ts 3100
```

**Elysia:**
```bash
npx tsx benchmarks/apps/elysia-routing.ts 3200
```

### 2. JSON Benchmark

**OpenSpeed:**
```bash
npx tsx benchmarks/apps/openspeed-json.ts 3001
```

**Hono:**
```bash
npx tsx benchmarks/apps/hono-json.ts 3101
```

**Elysia:**
```bash
npx tsx benchmarks/apps/elysia-json.ts 3201
```

## Load Testing

Once a server is running, use autocannon to test it:

### Basic Routing Test
```bash
npx autocannon -c 100 -d 10 http://localhost:3000/
```

### JSON Processing Test
```bash
npx autocannon -c 50 -d 10 -m POST -H "Content-Type: application/json" -b '{"message":"hello","data":[1,2,3,4,5]}' http://localhost:3001/json
```

### Health Check
```bash
curl http://localhost:3000/health
```

## Test Scenarios

### Routing Scenario
Tests various route patterns:
- `/` - Simple text response
- `/user/:id` - Path parameters
- `/api/v1/users/:userId/posts/:postId` - Nested parameters
- `/search?q=test&limit=10` - Query parameters
- `/files/:filename` - File-like routes
- `/assets/*` - Wildcard routes

### JSON Scenario
Tests JSON processing:
- `/json` - JSON parsing and validation
- `/json-response?size=1000` - Large JSON generation
- `/json-stream?chunks=10` - Streaming simulation
- `/json-transform` - Data transformation
- `/json-validate` - Schema validation

## Comparing Results

Run each framework and compare the autocannon output:

**Metrics to compare:**
- Requests/sec (higher is better)
- Latency average (lower is better)
- Latency p95/p99 (lower is better)
- Throughput MB/sec (higher is better)

### Example Workflow

1. **Start OpenSpeed server:**
   ```bash
   npx tsx benchmarks/apps/openspeed-routing.ts 3000
   ```

2. **In another terminal, run benchmark:**
   ```bash
   npx autocannon -c 100 -d 10 http://localhost:3000/
   ```

3. **Record results**

4. **Stop server (Ctrl+C)**

5. **Repeat for Hono and Elysia**

## Understanding the Refactored Code

### Shared Configuration Benefits
- **Single source of truth**: Route definitions in one place
- **Consistency**: All frameworks test the same endpoints
- **Easy updates**: Change routes in one file, applies to all frameworks
- **No duplication**: ~80% less duplicated code

### File Structure
```
benchmarks/
├── shared/
│   ├── routing.ts      # Shared route configs
│   └── json.ts         # Shared JSON configs
├── apps/
│   ├── openspeed-routing.ts
│   ├── openspeed-json.ts
│   ├── hono-routing.ts
│   ├── hono-json.ts
│   ├── elysia-routing.ts
│   └── elysia-json.ts
```

### How It Works

Each framework-specific app imports the shared config:

```typescript
import { routingConfig, templateResponse } from '../shared/routing.js';

// Register routes from shared config
for (const route of routingConfig) {
  const handler = (ctx) => {
    const data = templateResponse(route.response.data, context);
    return ctx.json(data);
  };
  app[route.method](route.path, handler);
}
```

## Advanced: Custom Benchmarks

### Adding New Routes

Edit `benchmarks/shared/routing.ts`:

```typescript
export const routingConfig: RouteConfig[] = [
  // ... existing routes
  {
    method: 'get',
    path: '/custom-route',
    response: {
      type: 'json',
      data: { message: 'Custom response' }
    }
  }
];
```

The route automatically applies to all frameworks!

### Adding New Scenarios

1. Create new shared config in `benchmarks/shared/`
2. Create framework-specific apps that use the config
3. Follow the same pattern as routing/json scenarios

## Troubleshooting

### Server Won't Start
- Check if port is already in use
- Ensure dependencies are installed: `pnpm install`
- Build the project: `pnpm build`

### Autocannon Not Found
```bash
npm install -g autocannon
```

### Framework Not Responding
- Check server logs for errors
- Verify health endpoint: `curl http://localhost:PORT/health`
- Ensure correct port number

## Publishing Workflow

Before publishing a new version:

```bash
# Build the project
pnpm build

# Update version
pnpm version patch

# Publish (build is included in release script)
pnpm run release
```

The `release` script now includes `pnpm build` to ensure distribution files are up-to-date.

## Results Interpretation

### Sample Output
```
Running 10s test @ http://localhost:3000
100 connections

┌─────────┬──────┬──────┬───────┬──────┬─────────┬─────────┬────────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%  │ Avg     │ Stdev   │ Max    │
├─────────┼──────┼──────┼───────┼──────┼─────────┼─────────┼────────┤
│ Latency │ 0 ms │ 0 ms │ 1 ms  │ 2 ms │ 0.23 ms │ 0.52 ms │ 15 ms  │
└─────────┴──────┴──────┴───────┴──────┴─────────┴─────────┴────────┘

Req/Sec  │ 60000 │ 65000 │ 70000 │ 71000 │ 65234   │ 3421    │ 71823  │
└─────────┴───────┴───────┴───────┴───────┴─────────┴─────────┴────────┘

651k requests in 10.03s, 89.4 MB read
```

**Key metrics:**
- **Latency Avg**: Average response time (lower = better)
- **Latency p99**: 99% of requests completed within this time
- **Req/Sec**: Throughput (higher = better)

## Best Practices

1. **Consistent environment**: Run all tests on same machine
2. **Multiple runs**: Run each test 3-5 times, use average
3. **Clean state**: Restart server between tests
4. **System load**: Close other applications during testing
5. **Warm-up**: Make some requests before running benchmark

## Contributing

When adding new benchmarks:
1. Add to shared config first
2. Test with all three frameworks
3. Document in this guide
4. Update examples if needed

---

**Note**: The comprehensive benchmark runner (`run-comprehensive.ts`) may have platform-specific issues on Windows. Use the manual testing approach above for consistent results.
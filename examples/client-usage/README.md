# OpenSpeed Client Usage Example

This example demonstrates how to generate and use the end-to-end type-safe TypeScript client for OpenSpeed APIs, providing auto-completion, runtime validation, and type inference.

## Features

- **Type Safety**: Full TypeScript types for requests and responses.
- **Runtime Validation**: Zod schemas validate data at runtime.
- **Auto-completion**: IDE support for API calls.
- **Flexible Options**: Support for headers, authentication, path/query parameters.

## Prerequisites

- Node.js >= 20
- An OpenSpeed server running with the OpenAPI plugin configured.

## Generating the Client

1. Ensure your OpenSpeed app uses the OpenAPI plugin and defines routes with Zod schemas.

   ```typescript
   import { OpenSpeed } from 'openspeed';
   import { openapi } from 'openspeed/plugins';
   import { z } from 'zod';

   const app = new OpenSpeed();
   const api = openapi({ title: 'My API', version: '1.0.0' });

   // Define a route with types
   api.collect('GET', '/users/:id', {
     parameters: [{ name: 'id', in: 'path', schema: z.string() }],
     responses: {
       '200': { schema: z.object({ id: z.string(), name: z.string() }) }
     }
   });

   app.use(api.middleware);
   ```

2. Start the server:

   ```bash
   npm run dev
   ```

3. Generate the client:

   ```bash
   npx openspeed client client.ts
   ```

   This fetches the generated TypeScript client from `/client.ts` and saves it to `client.ts`.

## Using the Client

Import the generated client in your frontend project:

```typescript
import { OpenSpeedClient } from './client.ts';

const client = new OpenSpeedClient('http://localhost:3000');

// Example: Fetch a user with path parameter
const user = await client.users$id({ pathParams: { id: '123' } });

// Example: List users with query parameter and auth
const users = await client.users({
  queryParams: { limit: 10 },
  options: { auth: 'Bearer your-token' }
});

// Example: Create a user with request body
const newUser = await client.users({
  body: { name: 'John Doe' },
  options: { headers: { 'X-Custom': 'value' } }
});
```

## Type Safety Benefits

- **Compile-time Checks**: Catch API usage errors at build time.
- **IntelliSense**: Auto-complete for parameters and responses.
- **Runtime Validation**: Automatic parsing and validation of responses with Zod.

## Running the Example

1. Clone the OpenSpeed repository.
2. Navigate to `examples/client-usage`.
3. Follow the setup steps above.
4. Integrate the generated client into your application.

For more advanced usage, refer to the OpenSpeed documentation.
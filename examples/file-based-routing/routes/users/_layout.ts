import type { Context } from '../../../../src/openspeed/context.js';

// Layout middleware for user routes
// This runs for all routes under /users/**
export async function middleware(ctx: Context, next: () => Promise<any>) {
  // Add user route context
  ctx.memory = ctx.memory || {};
  ctx.memory.routeType = 'user';
  ctx.memory.timestamp = new Date().toISOString();

  // Log user route access
  console.log(`[User Route] ${ctx.req.method} ${ctx.req.url}`);

  try {
    const result = await next();

    // Add common response metadata for user routes
    if (result && typeof result === 'object' && !result.error) {
      result._metadata = {
        route: 'user',
        accessedAt: ctx.memory.timestamp,
        version: '1.0.0',
      };
    }

    return result;
  } catch (error) {
    console.error(`[User Route Error] ${error instanceof Error ? error.message : String(error)}`);
    return ctx.json(
      {
        error: 'Internal server error in user routes',
        timestamp: ctx.memory.timestamp,
      },
      500
    );
  }
}

// Layout component (for API responses, this could format the response)
export default async function layout(ctx: Context, children: any) {
  // For API routes, layout could wrap the response with additional metadata
  const baseResponse = {
    success: !children?.error,
    data: children,
    layout: 'user-routes',
  };

  return baseResponse;
}

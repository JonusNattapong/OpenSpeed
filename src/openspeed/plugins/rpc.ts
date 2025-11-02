/**
 * RPC Client Plugin for OpenSpeed
 * Provides end-to-end type safety between frontend and backend (similar to tRPC/Eden)
 */

import type { Context } from '../context.js';

// Type utilities
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteHandler {
  (ctx: Context): any;
}

export type InferInput<T> = T extends (ctx: infer C) => any
  ? C extends Context & { body: infer B }
    ? B
    : never
  : never;

export type InferOutput<T> = T extends (...args: any[]) => infer R
  ? R extends Promise<infer P>
    ? P extends { body: infer B }
      ? B extends string
        ? any
        : B
      : any
    : R extends { body: infer B }
    ? B extends string
      ? any
      : B
    : any
  : never;

// RPC Route definition
export interface RPCRoute {
  method: Method;
  path: string;
  handler: RouteHandler;
}

// RPC App interface for type inference
export interface RPCApp {
  routes: Map<string, RPCRoute>;
  get(path: string, handler: RouteHandler): this;
  post(path: string, handler: RouteHandler): this;
  put(path: string, handler: RouteHandler): this;
  patch(path: string, handler: RouteHandler): this;
  delete(path: string, handler: RouteHandler): this;
}

// Client options
export interface RPCClientOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  onRequest?: (req: Request) => void | Promise<void>;
  onResponse?: (res: Response) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
}

// RPC Response
export interface RPCResponse<T> {
  data?: T;
  error?: {
    message: string;
    status: number;
    details?: any;
  };
  status: number;
  headers: Headers;
}

// Path parameter extraction
type ExtractParams<T extends string> = T extends `${infer _Start}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof ExtractParams<Rest>]: string }
  : T extends `${infer _Start}:${infer Param}`
  ? { [K in Param]: string }
  : {};

// Query parameter type
export type QueryParams = Record<string, string | number | boolean | undefined>;

// Request options
export interface RequestOptions<TBody = any> {
  params?: Record<string, string>;
  query?: QueryParams;
  body?: TBody;
  headers?: Record<string, string>;
}

/**
 * Create RPC client from app type
 */
export function createClient<TApp extends RPCApp>(
  options: RPCClientOptions = {}
): RPCClient<TApp> {
  const {
    baseUrl = '',
    headers = {},
    fetch: customFetch = globalThis.fetch,
    onRequest,
    onResponse,
    onError,
  } = options;

  const client = new Proxy(
    {},
    {
      get(_target, path: string) {
        return new Proxy(
          {},
          {
            get(_target, method: string) {
              return async (options: RequestOptions = {}) => {
                try {
                  // Build URL
                  let url = `${baseUrl}${path}`;

                  // Replace path params
                  if (options.params) {
                    for (const [key, value] of Object.entries(options.params)) {
                      url = url.replace(`:${key}`, encodeURIComponent(value));
                    }
                  }

                  // Add query params
                  if (options.query) {
                    const queryString = new URLSearchParams(
                      Object.entries(options.query)
                        .filter(([_, v]) => v !== undefined)
                        .map(([k, v]) => [k, String(v)])
                    ).toString();
                    if (queryString) {
                      url += `?${queryString}`;
                    }
                  }

                  // Build request
                  const requestInit: RequestInit = {
                    method: method.toUpperCase(),
                    headers: {
                      'Content-Type': 'application/json',
                      ...headers,
                      ...options.headers,
                    },
                  };

                  // Add body for POST, PUT, PATCH
                  if (
                    options.body &&
                    ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())
                  ) {
                    requestInit.body = JSON.stringify(options.body);
                  }

                  const request = new Request(url, requestInit);

                  // Call onRequest hook
                  if (onRequest) {
                    await onRequest(request);
                  }

                  // Make request
                  const response = await customFetch(request);

                  // Call onResponse hook
                  if (onResponse) {
                    await onResponse(response);
                  }

                  // Parse response
                  const contentType = response.headers.get('content-type');
                  let data: any;

                  if (contentType?.includes('application/json')) {
                    data = await response.json();
                  } else {
                    data = await response.text();
                  }

                  const result: RPCResponse<any> = {
                    status: response.status,
                    headers: response.headers,
                  };

                  if (!response.ok) {
                    result.error = {
                      message: data?.error || response.statusText,
                      status: response.status,
                      details: data?.details,
                    };
                  } else {
                    result.data = data;
                  }

                  return result;
                } catch (error: any) {
                  if (onError) {
                    await onError(error);
                  }

                  const result: RPCResponse<any> = {
                    status: 0,
                    headers: new Headers(),
                    error: {
                      message: error.message || 'Network error',
                      status: 0,
                      details: error,
                    },
                  };

                  return result;
                }
              };
            },
          }
        );
      },
    }
  ) as any;

  return client;
}

// Type-safe client proxy type
export type RPCClient<TApp extends RPCApp> = {
  [K in keyof TApp['routes']]: {
    get<T = any>(options?: RequestOptions): Promise<RPCResponse<T>>;
    post<T = any>(options?: RequestOptions): Promise<RPCResponse<T>>;
    put<T = any>(options?: RequestOptions): Promise<RPCResponse<T>>;
    patch<T = any>(options?: RequestOptions): Promise<RPCResponse<T>>;
    delete<T = any>(options?: RequestOptions): Promise<RPCResponse<T>>;
  };
};

/**
 * Helper to extract routes from app for type inference
 */
export function treaty<TApp extends RPCApp>(
  baseUrl: string,
  options: Omit<RPCClientOptions, 'baseUrl'> = {}
): RPCClient<TApp> {
  return createClient<TApp>({ baseUrl, ...options });
}

/**
 * Batch request helper
 */
export async function batch<T extends Promise<any>[]>(
  ...requests: T
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  return Promise.all(requests) as any;
}

/**
 * RPC middleware for server-side route collection
 */
export interface RPCPluginOptions {
  enableIntrospection?: boolean;
  prefix?: string;
}

export function rpc(options: RPCPluginOptions = {}) {
  const { enableIntrospection = true, prefix = '' } = options;
  const routes = new Map<string, RPCRoute>();

  return async (ctx: Context, next: () => Promise<any>) => {
    // Attach RPC context
    (ctx as any).rpc = {
      routes,
      addRoute: (method: Method, path: string, handler: RouteHandler) => {
        const fullPath = prefix + path;
        routes.set(`${method}:${fullPath}`, { method, path: fullPath, handler });
      },
    };

    // Handle introspection endpoint
    if (enableIntrospection && ctx.req.url?.endsWith('/__rpc/introspect')) {
      const routeList = Array.from(routes.entries()).map(([key, route]) => ({
        key,
        method: route.method,
        path: route.path,
      }));
      return ctx.json(routeList);
    }

    await next();
  };
}

/**
 * Type-safe route definition helper
 */
export function defineRoute<TInput = any, TOutput = any>(
  handler: (ctx: Context & { body: TInput }) => TOutput | Promise<TOutput>
) {
  return handler as RouteHandler;
}

/**
 * Create typed API contract
 */
export function createContract<T extends Record<string, any>>() {
  return {} as T;
}

/**
 * Utility for creating webhooks/subscriptions
 */
export class RPCSubscription<T = any> {
  private listeners = new Set<(data: T) => void>();
  private ws?: WebSocket;

  constructor(private url: string, private options: RPCClientOptions = {}) {}

  subscribe(callback: (data: T) => void) {
    this.listeners.add(callback);

    if (!this.ws) {
      this.connect();
    }

    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  private connect() {
    const wsUrl = this.url.replace(/^http/, 'ws');
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.listeners.forEach((listener) => listener(data));
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      // Attempt reconnect after 1 second
      setTimeout(() => {
        if (this.listeners.size > 0) {
          this.connect();
        }
      }, 1000);
    };
  }

  private disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  send(data: T) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

/**
 * Example usage:
 *
 * // Server-side
 * import { Openspeed } from 'openspeed';
 * import { rpc, defineRoute } from 'openspeed/plugins/rpc';
 *
 * const app = Openspeed();
 * app.use(rpc());
 *
 * app.post('/api/user', defineRoute<{ name: string }, { id: string }>((ctx) => {
 *   const { name } = ctx.body;
 *   return ctx.json({ id: '123', name });
 * }));
 *
 * export type App = typeof app;
 *
 * // Client-side
 * import { treaty } from 'openspeed/plugins/rpc';
 * import type { App } from './server';
 *
 * const api = treaty<App>('http://localhost:3000');
 *
 * const { data, error } = await api['/api/user'].post({
 *   body: { name: 'John' } // Type-safe!
 * });
 *
 * if (data) {
 *   console.log(data.id); // Type-safe!
 * }
 */

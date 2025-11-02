/**
 * Streaming Plugin for OpenSpeed
 * Provides support for streaming responses using generators and ReadableStreams
 */

import type { Context } from '../context.js';

// Runtime-agnostic type definitions
declare const TextEncoder: any;
declare const ReadableStream: any;
declare const Bun: any;
declare const Deno: any;

export interface StreamOptions {
  headers?: Record<string, string>;
  contentType?: string;
  onError?: (error: Error) => void;
}

export interface SSEOptions extends StreamOptions {
  retry?: number;
  keepAlive?: number;
}

/**
 * Stream plugin - adds streaming helpers to context
 */
export function stream() {
  return async (ctx: Context, next: () => Promise<any>) => {
    // Add streaming helpers to context
    (ctx as any).stream = createStreamHelper(ctx);
    (ctx as any).streamSSE = createSSEHelper(ctx);
    (ctx as any).streamText = createTextStreamHelper(ctx);
    (ctx as any).streamJSON = createJSONStreamHelper(ctx);

    await next();
  };
}

/**
 * Create stream from generator function
 */
export function createStreamHelper(ctx: Context) {
  return (generator: AsyncGenerator<unknown> | Generator<unknown>, options: StreamOptions = {}) => {
    const { headers = {}, contentType = 'text/plain; charset=utf-8', onError } = options;

    const encoder = new TextEncoder();
    let closed = false;

    const readableStream = new ReadableStream({
      async start(controller: any) {
        try {
          for await (const chunk of generator) {
            if (closed) break;

            const data = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
            controller.enqueue(encoder.encode(data));
          }
          controller.close();
        } catch (error: any) {
          if (onError) {
            onError(error);
          }
          controller.error(error);
        }
      },
      cancel() {
        closed = true;
      },
    });

    ctx.res.status = 200;
    ctx.res.headers = {
      ...ctx.res.headers,
      'content-type': contentType,
      'transfer-encoding': 'chunked',
      ...headers,
    };
    ctx.res.body = readableStream;

    return ctx.res;
  };
}

/**
 * Server-Sent Events (SSE) stream helper
 */
export function createSSEHelper(ctx: Context) {
  return (generator: AsyncGenerator<unknown> | Generator<unknown>, options: SSEOptions = {}) => {
    const { headers = {}, retry = 3000, keepAlive = 30000, onError } = options;

    const encoder = new TextEncoder();
    let closed = false;
    let keepAliveInterval: NodeJS.Timeout | number | undefined;

    const readableStream = new ReadableStream({
      async start(controller: any) {
        try {
          // Send retry interval
          if (retry) {
            controller.enqueue(encoder.encode(`retry: ${retry}\n\n`));
          }

          // Set up keep-alive
          if (keepAlive) {
            keepAliveInterval = setInterval(() => {
              if (!closed) {
                controller.enqueue(encoder.encode(': keep-alive\n\n'));
              }
            }, keepAlive);
          }

          // Stream events
          for await (const chunk of generator) {
            if (closed) break;

            const event = formatSSEEvent(chunk);
            controller.enqueue(encoder.encode(event));
          }

          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
          }
          controller.close();
        } catch (error: any) {
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
          }
          if (onError) {
            onError(error);
          }
          controller.error(error);
        }
      },
      cancel() {
        closed = true;
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
        }
      },
    });

    ctx.res.status = 200;
    ctx.res.headers = {
      ...ctx.res.headers,
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'transfer-encoding': 'chunked',
      ...headers,
    };
    ctx.res.body = readableStream;

    return ctx.res;
  };
}

/**
 * Text streaming helper
 */
function createTextStreamHelper(ctx: Context) {
  return (options: StreamOptions = {}) => {
    const { headers = {} } = options;
    const chunks: string[] = [];

    const stream = {
      write(text: string) {
        chunks.push(text);
      },
      end() {
        // Mark as ended
      },
      chunks,
    };

    ctx.res.status = 200;
    ctx.res.headers = {
      ...ctx.res.headers,
      'content-type': 'text/plain; charset=utf-8',
      'transfer-encoding': 'chunked',
      ...headers,
    };

    return stream;
  };
}

/**
 * JSON streaming helper (NDJSON - newline delimited JSON)
 */
export function createJSONStreamHelper(ctx: Context) {
  return (generator: AsyncGenerator<unknown> | Generator<unknown>, options: StreamOptions = {}) => {
    const { headers = {}, onError } = options;

    const encoder = new TextEncoder();
    let closed = false;

    const readableStream = new ReadableStream({
      async start(controller: any) {
        try {
          for await (const chunk of generator) {
            if (closed) break;

            const json = JSON.stringify(chunk);
            controller.enqueue(encoder.encode(json + '\n'));
          }
          controller.close();
        } catch (error: any) {
          if (onError) {
            onError(error);
          }
          controller.error(error);
        }
      },
      cancel() {
        closed = true;
      },
    });

    ctx.res.status = 200;
    ctx.res.headers = {
      ...ctx.res.headers,
      'content-type': 'application/x-ndjson',
      'transfer-encoding': 'chunked',
      ...headers,
    };
    ctx.res.body = readableStream;

    return ctx.res;
  };
}

/**
 * Format data as SSE event
 */
function formatSSEEvent(data: unknown): string {
  if (typeof data === 'string') {
    return `data: ${data}\n\n`;
  }

  if (typeof data === 'object' && data !== null) {
    // Handle SSE event object
    if ('event' in data || 'id' in data || 'data' in data) {
      const eventData = data as Record<string, unknown>;
      let event = '';
      if (eventData.id) {
        event += `id: ${eventData.id}\n`;
      }
      if (eventData.event) {
        event += `event: ${eventData.event}\n`;
      }
      if (eventData.retry) {
        event += `retry: ${eventData.retry}\n`;
      }
      if (eventData.data !== undefined) {
        const dataStr =
          typeof eventData.data === 'string' ? eventData.data : JSON.stringify(eventData.data);
        event += `data: ${dataStr}\n`;
      }
      event += '\n';
      return event;
    }

    // Default JSON serialization
    return `data: ${JSON.stringify(data)}\n\n`;
  }

  return `data: ${String(data)}\n\n`;
}

/**
 * Helper to create a generator from an array
 */
export async function* fromArray<T>(array: T[]): AsyncGenerator<T> {
  for (const item of array) {
    yield item;
  }
}

/**
 * Helper to create a generator from a stream
 */
export async function* fromReadableStream<T>(stream: any): AsyncGenerator<T> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Helper to pipe generators
 */
export async function* pipe<T, U>(
  source: AsyncGenerator<T>,
  transform: (chunk: T) => U | Promise<U>
): AsyncGenerator<U> {
  for await (const chunk of source) {
    yield await transform(chunk);
  }
}

/**
 * Helper to filter generator
 */
export async function* filter<T>(
  source: AsyncGenerator<T>,
  predicate: (chunk: T) => boolean | Promise<boolean>
): AsyncGenerator<T> {
  for await (const chunk of source) {
    if (await predicate(chunk)) {
      yield chunk;
    }
  }
}

/**
 * Helper to batch generator chunks
 */
export async function* batch<T>(source: AsyncGenerator<T>, size: number): AsyncGenerator<T[]> {
  let buffer: T[] = [];
  for await (const chunk of source) {
    buffer.push(chunk);
    if (buffer.length >= size) {
      yield buffer;
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    yield buffer;
  }
}

/**
 * Helper to throttle generator
 */
export async function* throttle<T>(source: AsyncGenerator<T>, delayMs: number): AsyncGenerator<T> {
  for await (const chunk of source) {
    yield chunk;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

/**
 * Helper to merge multiple generators
 */
export async function* merge<T>(...sources: AsyncGenerator<T>[]): AsyncGenerator<T> {
  const promises = sources.map(async (source) => {
    const items: T[] = [];
    for await (const item of source) {
      items.push(item);
    }
    return items;
  });

  const results = await Promise.all(promises);
  for (const items of results) {
    for (const item of items) {
      yield item;
    }
  }
}

/**
 * Create a file stream
 */
export function streamFile(filePath: string, _options: StreamOptions = {}) {
  return async function* () {
    // This is a placeholder - actual implementation would depend on runtime
    // For Node.js, you'd use fs.createReadStream
    // For Bun, you'd use Bun.file
    // For Deno, you'd use Deno.readFile or Deno.open

    if (typeof Bun !== 'undefined' && Bun) {
      // Bun runtime
      const file = Bun.file(filePath);
      const stream = file.stream();
      for await (const chunk of stream) {
        yield chunk;
      }
    } else if (typeof Deno !== 'undefined' && Deno) {
      // Deno runtime
      const file = await Deno.open(filePath, { read: true });
      const buffer = new Uint8Array(1024 * 64); // 64KB chunks
      while (true) {
        const bytesRead = await file.read(buffer);
        if (bytesRead === null) break;
        yield buffer.slice(0, bytesRead);
      }
      file.close();
    } else {
      // Node.js runtime
      const fs = await import('fs');
      const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 64 });
      for await (const chunk of stream) {
        yield chunk;
      }
    }
  };
}

/**
 * Example usage:
 *
 * import { stream, streamFile, fromArray, pipe } from 'openspeed/plugins/stream';
 *
 * app.use(stream());
 *
 * // Generator function streaming
 * app.get('/stream', (ctx) => {
 *   return ctx.stream(async function* () {
 *     yield 'Hello ';
 *     await new Promise(r => setTimeout(r, 1000));
 *     yield 'World!';
 *   }());
 * });
 *
 * // Server-Sent Events
 * app.get('/events', (ctx) => {
 *   return ctx.streamSSE(async function* () {
 *     let count = 0;
 *     while (count < 10) {
 *       yield { data: { count, timestamp: Date.now() } };
 *       await new Promise(r => setTimeout(r, 1000));
 *       count++;
 *     }
 *   }());
 * });
 *
 * // JSON streaming (NDJSON)
 * app.get('/data', (ctx) => {
 *   return ctx.streamJSON(async function* () {
 *     for (let i = 0; i < 100; i++) {
 *       yield { id: i, value: Math.random() };
 *     }
 *   }());
 * });
 *
 * // File streaming
 * app.get('/file', (ctx) => {
 *   return ctx.stream(streamFile('./large-file.txt')());
 * });
 *
 * // Transform and filter
 * app.get('/filtered', (ctx) => {
 *   const numbers = async function* () {
 *     for (let i = 0; i < 100; i++) yield i;
 *   };
 *
 *   const evens = filter(numbers(), n => n % 2 === 0);
 *   const doubled = pipe(evens, n => n * 2);
 *
 *   return ctx.streamJSON(doubled);
 * });
 */

import zlib from 'zlib';
import type { Context } from '../context.js';

export interface CompressionOptions {
  level?: number; // Compression level (1-9)
  threshold?: number; // Minimum response size to compress (bytes)
  algorithms?: ('gzip' | 'deflate' | 'br')[]; // Supported algorithms
  filter?: (contentType: string) => boolean; // Function to filter compressible content types
}

export function compressionPlugin(options: CompressionOptions = {}) {
  const {
    level = 6,
    threshold = 1024,
    algorithms = ['gzip', 'br'],
    filter = (contentType: string) => {
      return /text|javascript|json|xml|css/.test(contentType);
    }
  } = options;

  return async (ctx: Context, next: () => Promise<any>) => {
    // Store original response methods
    const originalJson = ctx.json.bind(ctx);
    const originalText = ctx.text.bind(ctx);
    const originalHtml = ctx.html.bind(ctx);

    // Override response methods to add compression
    ctx.json = (data: any, status = 200) => {
      const response = originalJson(data, status);
      return compressResponse(ctx, response, { level, threshold, algorithms, filter });
    };

    ctx.text = (text: string, status = 200) => {
      const response = originalText(text, status);
      return compressResponse(ctx, response, { level, threshold, algorithms, filter });
    };

    ctx.html = (html: string, status = 200) => {
      const response = originalHtml(html, status);
      return compressResponse(ctx, response, { level, threshold, algorithms, filter });
    };

    await next();
  };
}

function compressResponse(
  ctx: Context,
  response: any,
  options: Required<CompressionOptions>
): any {
  const { level, threshold, algorithms, filter } = options;

  // Check if compression should be applied
  if (!response.body ||
      typeof response.body !== 'string' ||
      Buffer.byteLength(response.body, 'utf8') < threshold) {
    return response;
  }

  // Check content type filter
  const contentType = response.headers?.['content-type'] || '';
  if (!filter(contentType)) {
    return response;
  }

  // Get client's accepted encodings
  const acceptEncoding = ctx.req.headers?.['accept-encoding'] as string || '';

  let compressionAlgorithm: 'gzip' | 'deflate' | 'br' | null = null;

  if (algorithms.includes('br') && acceptEncoding.includes('br')) {
    compressionAlgorithm = 'br';
  } else if (algorithms.includes('gzip') && acceptEncoding.includes('gzip')) {
    compressionAlgorithm = 'gzip';
  } else if (algorithms.includes('deflate') && acceptEncoding.includes('deflate')) {
    compressionAlgorithm = 'deflate';
  }

  if (!compressionAlgorithm) {
    return response;
  }

  // Compress the response body
  const compressedBody = compressSync(response.body, compressionAlgorithm, level);

  // Update response headers
  response.headers = {
    ...response.headers,
    'content-encoding': compressionAlgorithm,
    'vary': 'Accept-Encoding',
    'content-length': Buffer.byteLength(compressedBody, 'utf8').toString()
  };

  response.body = compressedBody;

  return response;
}

function compressSync(data: string, algorithm: 'gzip' | 'deflate' | 'br', level: number): Buffer {
  const buffer = Buffer.from(data, 'utf8');

  switch (algorithm) {
    case 'gzip':
      return zlib.gzipSync(buffer, { level });
    case 'deflate':
      return zlib.deflateSync(buffer, { level });
    case 'br':
      return zlib.brotliCompressSync(buffer, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: level,
        }
      });
    default:
      return buffer;
  }
}
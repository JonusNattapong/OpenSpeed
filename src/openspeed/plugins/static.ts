import { readFileSync, existsSync, statSync } from 'fs';
import { extname, join } from 'path';
import type { Context } from '../context.js';

export interface StaticOptions {
  root: string;
  prefix?: string;
  index?: string;
  maxAge?: number;
  etag?: boolean;
  lastModified?: boolean;
  setHeaders?: (ctx: Context, path: string, stat: any) => void;
}

const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

export function serveStatic(options: StaticOptions) {
  const {
    root,
    prefix = '/static',
    index = 'index.html',
    maxAge = 0,
    etag = true,
    lastModified = true,
    setHeaders
  } = options;

  return async (ctx: Context, next: () => Promise<any>) => {
    const url = new URL(ctx.req.url);
    const pathname = url.pathname;

    // Check if path matches prefix
    if (!pathname.startsWith(prefix)) {
      return next();
    }

    // Remove prefix and get file path
    const relativePath = pathname.slice(prefix.length);
    const filePath = join(root, relativePath);

    // Security check - prevent directory traversal
    if (filePath.includes('..') || !filePath.startsWith(root)) {
      ctx.res.status = 403;
      ctx.res.body = 'Forbidden';
      return;
    }

    try {
      // Check if file exists
      if (!existsSync(filePath)) {
        // Try index file for directories
        const indexPath = join(filePath, index);
        if (existsSync(indexPath)) {
          return serveFile(ctx, indexPath, maxAge, etag, lastModified, setHeaders);
        }
        return next();
      }

      const stat = statSync(filePath);

      // Handle directories
      if (stat.isDirectory()) {
        const indexPath = join(filePath, index);
        if (existsSync(indexPath)) {
          return serveFile(ctx, indexPath, maxAge, etag, lastModified, setHeaders);
        }
        ctx.res.status = 403;
        ctx.res.body = 'Directory listing not allowed';
        return;
      }

      // Serve file
      return serveFile(ctx, filePath, maxAge, etag, lastModified, setHeaders);

    } catch (error) {
      ctx.res.status = 500;
      ctx.res.body = 'Internal server error';
      return;
    }
  };
}

async function serveFile(
  ctx: Context,
  filePath: string,
  maxAge: number,
  etag: boolean,
  lastModified: boolean,
  setHeaders?: (ctx: Context, path: string, stat: any) => void
) {
  const stat = statSync(filePath);
  const ext = extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  // Set headers
  ctx.res.headers = {
    ...ctx.res.headers,
    'Content-Type': contentType,
    'Content-Length': stat.size.toString()
  };

  if (maxAge > 0) {
    ctx.res.headers['Cache-Control'] = `public, max-age=${maxAge}`;
  }

  if (etag) {
    const etagValue = `"${stat.mtime.getTime().toString(16)}-${stat.size.toString(16)}"`;
    ctx.res.headers['ETag'] = etagValue;

    // Check if client has current version
    const ifNoneMatch = ctx.req.headers['if-none-match'];
    if (ifNoneMatch === etagValue) {
      ctx.res.status = 304;
      return;
    }
  }

  if (lastModified) {
    ctx.res.headers['Last-Modified'] = stat.mtime.toUTCString();

    // Check if client has current version
    const ifModifiedSince = ctx.req.headers['if-modified-since'];
    const ifModifiedSinceStr = Array.isArray(ifModifiedSince) ? ifModifiedSince[0] : ifModifiedSince;
    if (ifModifiedSinceStr && new Date(ifModifiedSinceStr) >= stat.mtime) {
      ctx.res.status = 304;
      return;
    }
  }

  // Custom headers
  if (setHeaders) {
    setHeaders(ctx, filePath, stat);
  }

  // Read and serve file
  try {
    const content = readFileSync(filePath);
    ctx.res.body = content;
  } catch (error) {
    ctx.res.status = 500;
    ctx.res.body = 'Error reading file';
  }
}

// Named export alias for compatibility: `import { static }`
export { serveStatic as static };
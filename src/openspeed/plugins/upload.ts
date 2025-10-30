import type { Context, FileUpload } from '../context.js';
import { createReadStream, statSync } from 'fs';
import { extname, basename } from 'path';
import { Readable } from 'stream';

export interface UploadOptions {
  limits?: {
    fileSize?: number;
    files?: number;
    fields?: number;
  };
  preservePath?: boolean;
  defCharset?: string;
  defParamCharset?: string;
}

export function upload(options: UploadOptions = {}) {
  const {
    limits = {},
    preservePath = false,
    defCharset = 'utf8',
    defParamCharset = 'utf8'
  } = options;

  const {
    fileSize = 1024 * 1024, // 1MB
    files = 10,
    fields = 1000
  } = limits;

  return async (ctx: Context, next: () => Promise<any>) => {
    if (!ctx.req.body || typeof ctx.req.body !== 'object') {
      return next();
    }

    // Check if it's multipart form data
    const contentType = ctx.req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return next();
    }

    try {
      const files = await parseMultipart(ctx.req, {
        limits,
        preservePath,
        defCharset,
        defParamCharset
      });

      // Attach parsed files to request
      ctx.req.files = files;
      await next();
    } catch (error: any) {
      ctx.res.status = 400;
      ctx.res.body = JSON.stringify({
        error: 'File upload failed',
        message: error.message
      });
      return;
    }
  };
}

// Simple multipart parser (in production, use a proper library like multer)
async function parseMultipart(req: any, options: any): Promise<Record<string, FileUpload[]>> {
  // This is a simplified implementation
  // In production, use a proper multipart parser
  const boundary = getBoundary(req.headers['content-type']);
  if (!boundary) {
    throw new Error('Invalid multipart form data');
  }

  // For now, return empty object - implement proper parsing later
  return {};
}

function getBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=([^;]+)/);
  return match ? match[1] : null;
}

// Helper to handle single file uploads
export function single(fieldName: string) {
  return (ctx: Context, next: () => Promise<any>) => {
    if (ctx.req.files && ctx.req.files[fieldName] && ctx.req.files[fieldName].length > 0) {
      ctx.req.file = ctx.req.files[fieldName][0];
    }
    return next();
  };
}

// Helper to handle multiple file uploads
export function array(fieldName: string, maxCount = 10) {
  return (ctx: Context, next: () => Promise<any>) => {
    if (ctx.req.files && ctx.req.files[fieldName]) {
      ctx.req.files[fieldName] = ctx.req.files[fieldName].slice(0, maxCount);
    }
    return next();
  };
}

// Helper to handle multiple fields
export function fields(fields: string[]) {
  return (ctx: Context, next: () => Promise<any>) => {
    if (ctx.req.files) {
      const filteredFiles: Record<string, FileUpload[]> = {};
      for (const field of fields) {
        if (ctx.req.files[field]) {
          filteredFiles[field] = ctx.req.files[field];
        }
      }
      ctx.req.files = filteredFiles;
    }
    return next();
  };
}
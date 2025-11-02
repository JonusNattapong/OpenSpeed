import type { Context, FileUpload } from '../context.js';
import { createReadStream, statSync, writeFileSync, unlinkSync } from 'fs';
import { extname, basename, join } from 'path';
import { Readable } from 'stream';
import { createHash } from 'crypto';

export interface UploadOptions {
  limits?: {
    fileSize?: number;
    files?: number;
    fields?: number;
  };
  preservePath?: boolean;
  defCharset?: string;
  defParamCharset?: string;
  // Security options
  allowedTypes?: string[]; // Allowed MIME types
  allowedExtensions?: string[]; // Allowed file extensions
  scanForMalware?: boolean; // Basic malware scanning
  quarantinePath?: string; // Path to quarantine suspicious files
  rateLimit?: {
    windowMs: number;
    maxUploads: number;
  };
  secureFilename?: boolean; // Generate secure filenames
}

// In-memory rate limiting store (use Redis in production)
const uploadAttempts = new Map<string, { count: number; resetTime: number }>();

export function upload(options: UploadOptions = {}) {
  const {
    limits = {},
    preservePath = false,
    defCharset = 'utf8',
    defParamCharset = 'utf8',
    allowedTypes = [],
    allowedExtensions = [],
    scanForMalware = false,
    quarantinePath = './quarantine',
    rateLimit,
    secureFilename = true,
  } = options;

  const {
    fileSize = 1024 * 1024, // 1MB
    files = 10,
    fields = 1000,
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

    // Get client IP for rate limiting
    const clientIP =
      ctx.req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      ctx.req.headers['x-real-ip']?.toString() ||
      ctx.req.headers['cf-connecting-ip']?.toString() ||
      'unknown';

    // Check rate limiting
    if (rateLimit) {
      const now = Date.now();
      const windowStart = now - rateLimit.windowMs;
      const attempts = uploadAttempts.get(clientIP) || {
        count: 0,
        resetTime: now + rateLimit.windowMs,
      };

      // Reset if window expired
      if (attempts.resetTime < now) {
        attempts.count = 0;
        attempts.resetTime = now + rateLimit.windowMs;
      }

      if (attempts.count >= rateLimit.maxUploads) {
        ctx.res.status = 429;
        ctx.res.body = JSON.stringify({
          error: 'Upload rate limit exceeded',
          retryAfter: Math.ceil((attempts.resetTime - now) / 1000),
        });
        return;
      }

      attempts.count++;
      uploadAttempts.set(clientIP, attempts);
    }

    try {
      const files = await parseMultipartSecure(ctx.req, {
        limits,
        preservePath,
        defCharset,
        defParamCharset,
        allowedTypes,
        allowedExtensions,
        scanForMalware,
        quarantinePath,
        secureFilename,
        clientIP,
      });

      // Attach parsed files to request
      ctx.req.files = files;
      await next();
    } catch (error: any) {
      console.error('[UPLOAD SECURITY]', error.message);
      ctx.res.status = error.status || 400;
      ctx.res.body = JSON.stringify({
        error: 'File upload failed',
        message: error.message,
      });
      return;
    }
  };
}

// Secure multipart parser with validation
async function parseMultipartSecure(req: any, options: any): Promise<Record<string, FileUpload[]>> {
  const {
    limits,
    preservePath,
    defCharset,
    defParamCharset,
    allowedTypes,
    allowedExtensions,
    scanForMalware,
    quarantinePath,
    secureFilename,
    clientIP,
  } = options;

  const boundary = getBoundary(req.headers['content-type']);
  if (!boundary) {
    throw new Error('Invalid multipart form data');
  }

  // Use a proper multipart parser (simplified for demo)
  // In production, use multer or busboy
  const files: Record<string, FileUpload[]> = {};
  let fileCount = 0;

  // Parse the multipart data (simplified implementation)
  const body = req.body as Buffer;
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = splitMultipart(body, boundaryBuffer);

  for (const part of parts) {
    const headers = parsePartHeaders(part.header);
    const contentDisposition = headers['content-disposition'];

    if (!contentDisposition || !contentDisposition.includes('form-data')) {
      continue;
    }

    const fieldName = getFieldName(contentDisposition);
    if (!fieldName) continue;

    const filename = getFilename(contentDisposition);
    if (filename) {
      // This is a file upload
      if (fileCount >= limits.files) {
        throw new Error(`Too many files. Maximum: ${limits.files}`);
      }

      // Validate filename security
      if (!isSecureFilename(filename)) {
        throw createSecurityError('Insecure filename detected', clientIP, filename);
      }

      // Generate secure filename if requested
      const finalFilename = secureFilename ? generateSecureFilename(filename) : filename;

      // Validate file size
      if (part.content.length > limits.fileSize) {
        throw new Error(`File too large. Maximum size: ${limits.fileSize} bytes`);
      }

      // Validate file type
      const mimeType = headers['content-type'] || 'application/octet-stream';
      if (allowedTypes.length > 0 && !allowedTypes.includes(mimeType)) {
        throw createSecurityError('File type not allowed', clientIP, mimeType);
      }

      // Validate file extension
      const extension = extname(filename).toLowerCase();
      if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
        throw createSecurityError('File extension not allowed', clientIP, extension);
      }

      // Basic malware scan
      if (scanForMalware && detectMalware(part.content)) {
        // Quarantine suspicious file
        const quarantineFile = join(quarantinePath, `quarantine_${Date.now()}_${finalFilename}`);
        try {
          writeFileSync(quarantineFile, part.content);
        } catch (error) {
          console.error('Failed to quarantine file:', error);
        }
        throw createSecurityError('Malicious file detected and quarantined', clientIP, filename);
      }

      const fileUpload: FileUpload = {
        filename: finalFilename,
        mimetype: mimeType,
        size: part.content.length,
        buffer: part.content,
        path: undefined, // Could save to disk here
        stream: Readable.from(part.content),
      };

      if (!files[fieldName]) {
        files[fieldName] = [];
      }
      files[fieldName].push(fileUpload);
      fileCount++;
    }
  }

  return files;
}

// Security utility functions
function isSecureFilename(filename: string): boolean {
  // Prevent path traversal attacks
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }

  // Prevent hidden files
  if (filename.startsWith('.')) {
    return false;
  }

  // Prevent system files
  const dangerousNames = [
    'con',
    'prn',
    'aux',
    'nul',
    'com1',
    'com2',
    'com3',
    'com4',
    'lpt1',
    'lpt2',
    'lpt3',
  ];
  const nameWithoutExt = basename(filename, extname(filename)).toLowerCase();
  if (dangerousNames.includes(nameWithoutExt)) {
    return false;
  }

  return true;
}

function generateSecureFilename(originalFilename: string): string {
  const extension = extname(originalFilename);
  const hash = createHash('sha256')
    .update(originalFilename + Date.now().toString())
    .digest('hex')
    .substring(0, 16);
  return `${hash}${extension}`;
}

function detectMalware(content: Buffer): boolean {
  // Basic malware detection (very simplified)
  // In production, use proper antivirus libraries
  const signatures = [
    Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}'), // EICAR test virus
    Buffer.from('<script>eval('), // Basic XSS attempt
    Buffer.from('<?php'), // PHP webshell attempt
  ];

  const contentStr = content.toString('utf8', 0, 1024).toLowerCase(); // Check first 1KB

  for (const signature of signatures) {
    if (content.includes(signature) || contentStr.includes(signature.toString().toLowerCase())) {
      return true;
    }
  }

  return false;
}

function createSecurityError(message: string, clientIP: string, details: any): Error {
  const error = new Error(
    `[SECURITY] ${message} - IP: ${clientIP}, Details: ${JSON.stringify(details)}`
  );
  (error as any).status = 403;
  return error;
}

// Multipart parsing utilities (simplified)
interface MultipartPart {
  header: Buffer;
  content: Buffer;
}

function splitMultipart(body: Buffer, boundary: Buffer): MultipartPart[] {
  const parts: MultipartPart[] = [];
  let start = body.indexOf(boundary);

  while (start !== -1) {
    const end = body.indexOf(boundary, start + boundary.length);
    if (end === -1) break;

    const partData = body.slice(start + boundary.length + 2, end - 2); // Remove \r\n
    const headerEnd = partData.indexOf(Buffer.from('\r\n\r\n'));

    if (headerEnd !== -1) {
      parts.push({
        header: partData.slice(0, headerEnd),
        content: partData.slice(headerEnd + 4),
      });
    }

    start = end;
  }

  return parts;
}

function parsePartHeaders(headerBuffer: Buffer): Record<string, string> {
  const headers: Record<string, string> = {};
  const headerStr = headerBuffer.toString();
  const lines = headerStr.split('\r\n');

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      headers[key.toLowerCase().trim()] = valueParts.join(':').trim();
    }
  }

  return headers;
}

function getFieldName(contentDisposition: string): string | null {
  const match = contentDisposition.match(/name="([^"]+)"/);
  return match ? match[1] : null;
}

function getFilename(contentDisposition: string): string | null {
  const match = contentDisposition.match(/filename="([^"]+)"/);
  return match ? match[1] : null;
}

function getBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=([^;]+)/);
  return match ? match[1] : null;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of uploadAttempts.entries()) {
    if (attempts.resetTime < now) {
      uploadAttempts.delete(ip);
    }
  }
}, 60000); // Clean up every minute

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

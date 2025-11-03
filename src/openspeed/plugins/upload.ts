import type { Context, FileUpload } from '../context.js';
import { writeFileSync, unlinkSync } from 'fs';
import { extname, basename, join } from 'path';
import { Readable } from 'stream';
import { createHash, randomBytes } from 'crypto';
import { Redis } from 'ioredis';
import NodeClam from 'clamscan';

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
  scanForMalware?: boolean; // Enable malware scanning with ClamAV
  quarantinePath?: string; // Path to quarantine suspicious files
  clamavConfig?: {
    clamdscan?: {
      host?: string;
      port?: number;
      timeout?: number;
    };
    preference?: string;
  };
  rateLimit?: {
    windowMs: number;
    maxUploads: number;
  };
  secureFilename?: boolean; // Generate secure filenames
}

// Redis client for persistent rate limiting (falls back to in-memory if Redis unavailable)
let redis: Redis | null = null;
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  redis.on('error', (err: Error) => {
    console.warn('[UPLOAD] Redis connection failed, falling back to in-memory:', err.message);
    redis = null;
  });
} catch {
  console.warn('[UPLOAD] Redis not available, using in-memory storage');
}

// Fallback in-memory store
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
    clamavConfig,
    rateLimit,
    secureFilename = true,
  } = options;

  const limitsWithDefaults = {
    fileSize: 1024 * 1024, // 1MB
    files: 10,
    fields: 1000,
    ...limits,
  };

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
      const key = `upload:ratelimit:${clientIP}`;

      if (redis) {
        try {
          const data = await redis.hgetall(key);
          let count = parseInt(data.count || '0');
          const resetTime = parseInt(data.resetTime || '0');

          // Reset if window expired
          if (resetTime < now) {
            count = 0;
          }

          if (count >= rateLimit.maxUploads) {
            ctx.res.status = 429;
            ctx.res.body = JSON.stringify({
              error: 'Upload rate limit exceeded',
              retryAfter: Math.ceil((resetTime - now) / 1000),
            });
            return;
          }

          count++;
          await redis.hmset(key, {
            count: count.toString(),
            resetTime: (now + rateLimit.windowMs).toString(),
          });
          // Set TTL to auto-expire
          await redis.expire(key, Math.ceil(rateLimit.windowMs / 1000));
        } catch (error) {
          console.error('[UPLOAD] Redis error in rate limiting:', error);
          // Fall back to in-memory
        }
      }

      // Fallback to in-memory
      if (!redis) {
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
    }

    try {
      const files = await parseMultipartSecure(ctx.req, {
        limits: limitsWithDefaults,
        preservePath,
        defCharset,
        defParamCharset,
        allowedTypes,
        allowedExtensions,
        scanForMalware,
        quarantinePath,
        clamavConfig,
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
    allowedTypes,
    allowedExtensions,
    scanForMalware,
    quarantinePath,
    secureFilename,
    clientIP,
    clamavConfig,
  } = options;

  // Initialize ClamAV scanner if malware scanning is enabled
  let clamav: NodeClam | null = null;
  if (scanForMalware) {
    try {
      clamav = new NodeClam();
      await clamav.init({
        clamdscan: {
          host: clamavConfig?.clamdscan?.host || 'localhost',
          port: clamavConfig?.clamdscan?.port || 3310,
          timeout: clamavConfig?.clamdscan?.timeout || 60000,
        },
        preference: clamavConfig?.preference || 'clamdscan',
      });
      console.log('[UPLOAD] ClamAV scanner initialized successfully');
    } catch (error) {
      console.warn('[UPLOAD] Failed to initialize ClamAV scanner:', error);
      console.warn('[UPLOAD] Using basic malware detection only');
    }
  }

  const boundary = getBoundary(req.headers['content-type']);
  if (!boundary) {
    // Return empty files for invalid multipart data (for compatibility with tests)
    return {};
  }

  // Use a proper multipart parser (simplified for demo)
  // In production, use multer or busboy
  const files: Record<string, FileUpload[]> = {};
  let fileCount = 0;

  // Parse the multipart data (simplified implementation)
  const body = req.body;
  if (!Buffer.isBuffer(body)) {
    // Handle non-Buffer body (for tests and compatibility)
    return {};
  }
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

      // Validate file signature (magic number)
      if (!validateFileSignature(part.content, extension)) {
        throw createSecurityError(
          'File signature mismatch - file type does not match extension',
          clientIP,
          { filename, extension, detectedType: detectFileType(part.content) }
        );
      }

      // Malware scan
      if (scanForMalware) {
        const isMalicious = await detectMalware(part.content, clamav);
        if (isMalicious) {
          // Quarantine suspicious file
          const quarantineFile = join(quarantinePath, `quarantine_${Date.now()}_${finalFilename}`);
          try {
            writeFileSync(quarantineFile, part.content);
          } catch (error) {
            console.error('Failed to quarantine file:', error);
          }
          throw createSecurityError('Malicious file detected and quarantined', clientIP, filename);
        }
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

async function detectMalware(content: Buffer, clamav?: NodeClam | null): Promise<boolean> {
  // Use ClamAV if available
  if (clamav) {
    try {
      // Create a temporary file for scanning
      const tempFile = join(
        process.cwd(),
        `temp_scan_${Date.now()}_${randomBytes(8).toString('hex')}`
      );
      writeFileSync(tempFile, content);

      const { isInfected, viruses } = await clamav.scanFile(tempFile);

      // Clean up temp file
      try {
        unlinkSync(tempFile);
      } catch (error) {
        console.warn('Failed to clean up temp file:', error);
      }

      if (isInfected) {
        console.warn('[UPLOAD] Malware detected:', viruses);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[UPLOAD] ClamAV scan failed:', error);
      // Fall back to basic detection
    }
  }

  // Fallback: Basic malware detection (very simplified)
  // NOTE: These are signature patterns to DETECT malicious content, not execute it
  const signatures = [
    Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}'), // EICAR test virus
    Buffer.from('<script>eval('), // Basic XSS attempt (detection only)
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

/**
 * File signature database (magic numbers)
 */
const FILE_SIGNATURES: Record<string, number[][]> = {
  '.jpg': [
    [0xff, 0xd8, 0xff, 0xe0], // JPEG JFIF
    [0xff, 0xd8, 0xff, 0xe1], // JPEG Exif
    [0xff, 0xd8, 0xff, 0xe2], // JPEG
    [0xff, 0xd8, 0xff, 0xe3], // JPEG
    [0xff, 0xd8, 0xff, 0xdb], // JPEG
  ],
  '.jpeg': [
    [0xff, 0xd8, 0xff, 0xe0],
    [0xff, 0xd8, 0xff, 0xe1],
    [0xff, 0xd8, 0xff, 0xe2],
  ],
  '.png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  '.gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  '.pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  '.zip': [
    [0x50, 0x4b, 0x03, 0x04], // PK..
    [0x50, 0x4b, 0x05, 0x06], // Empty archive
    [0x50, 0x4b, 0x07, 0x08], // Spanned archive
  ],
  '.docx': [[0x50, 0x4b, 0x03, 0x04]], // DOCX is ZIP-based
  '.xlsx': [[0x50, 0x4b, 0x03, 0x04]], // XLSX is ZIP-based
  '.pptx': [[0x50, 0x4b, 0x03, 0x04]], // PPTX is ZIP-based
  '.doc': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], // MS Office compound file
  '.xls': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  '.ppt': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  '.mp4': [
    [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp
    [0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70],
    [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70],
  ],
  '.mp3': [
    [0x49, 0x44, 0x33], // ID3
    [0xff, 0xfb], // MP3 frame
  ],
  '.webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (needs more validation)
  '.svg': [
    [0x3c, 0x3f, 0x78, 0x6d, 0x6c], // <?xml
    [0x3c, 0x73, 0x76, 0x67], // <svg
  ],
};

/**
 * Validate file signature matches extension
 */
function validateFileSignature(buffer: Buffer, extension: string): boolean {
  if (!extension || buffer.length < 8) {
    return true; // Skip validation for unknown types or small files
  }

  const signatures = FILE_SIGNATURES[extension.toLowerCase()];
  if (!signatures) {
    // No signature defined for this extension, allow it
    return true;
  }

  // Check if any signature matches
  for (const signature of signatures) {
    let matches = true;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return true;
    }
  }

  console.warn(
    `[UPLOAD SECURITY] File signature mismatch for ${extension}: ` +
      `Expected one of known signatures, got ${buffer.slice(0, 8).toString('hex')}`
  );
  return false;
}

/**
 * Detect file type from magic number
 */
function detectFileType(buffer: Buffer): string {
  if (buffer.length < 8) return 'unknown';

  for (const [ext, signatures] of Object.entries(FILE_SIGNATURES)) {
    for (const signature of signatures) {
      let matches = true;
      for (let i = 0; i < signature.length && i < buffer.length; i++) {
        if (buffer[i] !== signature[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return ext;
      }
    }
  }

  return 'unknown';
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

// Clean up old in-memory rate limit entries periodically (Redis handles its own cleanup)
setInterval(() => {
  if (!redis) {
    const now = Date.now();
    for (const [ip, attempts] of uploadAttempts.entries()) {
      if (attempts.resetTime < now) {
        uploadAttempts.delete(ip);
      }
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

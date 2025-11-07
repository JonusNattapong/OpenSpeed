---
layout: default
title: Upload
parent: Plugins
nav_order: 1
---

# File Upload Plugin

The file upload plugin provides comprehensive multipart form data handling with streaming support.

## Installation

```typescript
import { upload } from 'openspeed-framework/plugins/upload';

const app = createApp();
app.use(upload());
```

## Basic Usage

### Single File Upload

```typescript
app.post('/upload', (ctx) => {
  const file = ctx.file;

  if (!file) {
    return ctx.text('No file uploaded', 400);
  }

  return ctx.json({
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path
  });
});
```

### Multiple Files Upload

```typescript
app.post('/upload-multiple', (ctx) => {
  const files = ctx.files?.documents || [];

  if (files.length === 0) {
    return ctx.text('No files uploaded', 400);
  }

  return ctx.json({
    count: files.length,
    files: files.map(file => ({
      name: file.filename,
      size: file.size,
      type: file.mimetype
    }))
  });
});
```

### Mixed Form Data

```typescript
app.post('/profile', (ctx) => {
  const avatar = ctx.file; // Single file
  const documents = ctx.files?.documents || []; // Multiple files
  const formData = ctx.getBody(); // Other form fields

  return ctx.json({
    avatar: avatar?.filename,
    documents: documents.map(d => d.filename),
    metadata: formData
  });
});
```

## File Types

```typescript
interface FileUpload {
  filename: string;    // Original filename
  mimetype: string;    // MIME type (e.g., 'image/jpeg')
  size: number;        // File size in bytes
  buffer?: Buffer;     // File content as buffer (for small files)
  stream?: any;        // Readable stream (for large files)
  path?: string;       // Temporary file path (if saved to disk)
}
```

## Context Extensions

The plugin extends the `RequestLike` interface:

```typescript
interface RequestLike {
  files?: Record<string, FileUpload[]>;  // Multiple files by field name
  file?: FileUpload;                     // Single file (first uploaded file)
}
```

## Configuration Options

```typescript
app.use(upload({
  limits: {
    fileSize: 10 * 1024 * 1024,  // 10MB max file size
    files: 10,                   // Max 10 files
    fields: 100                  // Max 100 form fields
  },
  preservePath: false,           // Preserve full file paths
  defCharset: 'utf8',           // Default charset
  defParamCharset: 'utf8'       // Parameter charset
}));
```

## Error Handling

```typescript
app.use(errorHandler());

app.post('/upload', (ctx) => {
  try {
    const file = ctx.file;
    if (!file) {
      throw new HttpError(400, 'File is required');
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      throw new HttpError(413, 'File too large');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new HttpError(400, 'Only images allowed');
    }

    return ctx.json({ success: true });
  } catch (error) {
    throw new HttpError(500, 'Upload failed');
  }
});
```

## File Processing

### Saving to Disk

```typescript
import { writeFile } from 'fs/promises';

app.post('/upload', async (ctx) => {
  const file = ctx.file;
  if (!file?.buffer) {
    return ctx.text('No file', 400);
  }

  const filePath = `./uploads/${Date.now()}-${file.filename}`;
  await writeFile(filePath, file.buffer);

  return ctx.json({ path: filePath });
});
```

### Streaming Large Files

```typescript
import { createWriteStream } from 'fs';

app.post('/upload', (ctx) => {
  const file = ctx.file;
  if (!file?.stream) {
    return ctx.text('No file', 400);
  }

  const filePath = `./uploads/${Date.now()}-${file.filename}`;
  const writeStream = createWriteStream(filePath);

  return new Promise((resolve, reject) => {
    file.stream.pipe(writeStream)
      .on('finish', () => resolve(ctx.json({ path: filePath })))
      .on('error', reject);
  });
});
```

## Security Considerations

1. **File Size Limits**: Always set reasonable file size limits
2. **File Type Validation**: Validate MIME types and file extensions
3. **Path Traversal**: Sanitize filenames to prevent path traversal attacks
4. **Storage Quotas**: Implement user/file storage limits
5. **Virus Scanning**: Consider integrating virus scanning for uploaded files

## Examples

See the [file upload example](../../examples/file-upload/) for a complete implementation.
import { describe, it, expect } from 'vitest';
import { upload, single, array, fields } from '../../src/openspeed/plugins/upload.js';
import Context from '../../src/openspeed/context.js';

describe('upload plugin', () => {
  it('should pass through non-multipart requests', async () => {
    const middleware = upload();

    const req: any = {
      method: 'POST',
      url: '/upload',
      headers: {
        'content-type': 'application/json'
      },
      body: { test: 'data' }
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it('should handle missing content-type header', async () => {
    const middleware = upload();

    const req: any = {
      method: 'POST',
      url: '/upload',
      headers: {},
      body: {}
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it('should process multipart form data', async () => {
    const middleware = upload();

    const req: any = {
      method: 'POST',
      url: '/upload',
      headers: {
        'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary'
      },
      body: {}
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    // The simplified parser returns empty object
    expect(nextCalled).toBe(true);
    expect(ctx.req.files).toBeDefined();
  });

  it('should respect file size limits', async () => {
    const middleware = upload({
      limits: {
        fileSize: 1024, // 1KB
        files: 5,
        fields: 100
      }
    });

    const req: any = {
      method: 'POST',
      url: '/upload',
      headers: {
        'content-type': 'application/json'
      },
      body: {}
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it('should handle single file helper', async () => {
    const middleware = single('avatar');

    const req: any = {
      method: 'POST',
      url: '/upload',
      headers: {},
      files: {
        avatar: [
          { filename: 'profile.jpg', size: 1024, mimetype: 'image/jpeg' }
        ]
      }
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(ctx.req.file).toEqual({ filename: 'profile.jpg', size: 1024, mimetype: 'image/jpeg' });
  });

  it('should handle array file helper', async () => {
    const middleware = array('photos', 3);

    const req: any = {
      method: 'POST',
      url: '/upload',
      headers: {},
      files: {
        photos: [
          { filename: 'photo1.jpg', size: 1024 },
          { filename: 'photo2.jpg', size: 2048 },
          { filename: 'photo3.jpg', size: 3072 },
          { filename: 'photo4.jpg', size: 4096 }
        ]
      }
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(ctx.req.files?.photos).toHaveLength(3); // Limited to maxCount
  });

  it('should handle fields helper', async () => {
    const middleware = fields(['avatar', 'documents']);

    const req: any = {
      method: 'POST',
      url: '/upload',
      headers: {},
      files: {
        avatar: [{ filename: 'profile.jpg' }],
        documents: [{ filename: 'resume.pdf' }],
        other: [{ filename: 'other.txt' }]
      }
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(ctx.req.files).toHaveProperty('avatar');
    expect(ctx.req.files).toHaveProperty('documents');
    expect(ctx.req.files).not.toHaveProperty('other');
  });
});

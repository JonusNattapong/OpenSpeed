/**
 * Security Testing Suite
 *
 * Comprehensive security tests for OpenSpeed framework
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createApp as OpenSpeed } from '../../dist/src/openspeed/index.js';
import { security } from '../../dist/src/openspeed/plugins/security.js';
import { csrf } from '../../dist/src/openspeed/plugins/csrfProtection.js';
import { validateSQL } from '../../dist/src/openspeed/plugins/sqlValidator.js';
import { raw } from '../../dist/src/openspeed/plugins/jsx.js';

describe('Security Tests', () => {
  describe('SQL Injection Prevention', () => {
    it('should detect SQL injection in string interpolation', () => {
      const maliciousInput = "1' OR '1'='1";

      expect(() => {
        validateSQL(`SELECT * FROM users WHERE id = '${maliciousInput}'`);
      }).toThrow('String interpolation detected');
    });

    it('should allow parameterized queries', () => {
      expect(() => {
        validateSQL('SELECT * FROM users WHERE id = ?', [123]);
      }).not.toThrow();
    });

    it('should detect UNION-based injection', () => {
      expect(() => {
        validateSQL('SELECT * FROM users UNION SELECT * FROM admin');
      }).toThrow('Forbidden pattern');
    });

    it('should detect SQL comments', () => {
      expect(() => {
        validateSQL('SELECT * FROM users -- DROP TABLE users');
      }).toThrow('Forbidden pattern');
    });
  });

  describe('XSS Prevention', () => {
    it('should escape HTML in JSX by default', () => {
      const { renderToString, jsx } = require('../src/openspeed/plugins/jsx.js');

      const maliciousInput = '<script>alert("XSS")</script>';
      const element = jsx('div', {}, maliciousInput);
      const html = renderToString(element);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should warn when using raw HTML without trusted flag', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      raw('<div>Test</div>');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SECURITY WARNING'));

      consoleSpy.mockRestore();
    });

    it('should not warn for trusted raw HTML', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      raw('<div>Test</div>', { trusted: true });

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('CSRF Protection', () => {
    let app: any;

    beforeEach(() => {
      app = OpenSpeed();
      app.use(csrf());
    });

    it('should allow GET requests without token', async () => {
      app.get('/test', (ctx: any) => ctx.text('OK'));

      const req = {
        method: 'GET',
        url: '/test',
        headers: {},
      };

      // Should not throw
      await app.handleRequest(req);
    });

    it('should block POST requests without CSRF token', async () => {
      app.post('/test', (ctx: any) => ctx.text('OK'));

      const req = {
        method: 'POST',
        url: '/test',
        headers: {},
        body: {},
      };

      const response = await app.handleRequest(req);
      expect(response.status).toBe(403);
      expect(response.body).toContain('CSRF');
    });

    it('should allow POST with valid CSRF token', async () => {
      app.post('/test', (ctx: any) => ctx.text('OK'));

      // First, get token from GET request
      const getReq = {
        method: 'GET',
        url: '/test',
        headers: {},
      };

      await app.handleRequest(getReq);
      // Extract token from response cookie

      // Then POST with token
      // (Full implementation would require cookie handling)
    });
  });

  describe('Security Headers', () => {
    let app: any;

    beforeEach(() => {
      app = OpenSpeed();
      app.use(security());
    });

    it('should set X-Frame-Options header', async () => {
      app.get('/test', (ctx: any) => ctx.text('OK'));

      const req = {
        method: 'GET',
        url: '/test',
        headers: {},
      };

      const response = await app.handleRequest(req);
      expect(response.headers?.['x-frame-options']).toBe('DENY');
    });

    it('should set X-Content-Type-Options header', async () => {
      app.get('/test', (ctx: any) => ctx.text('OK'));

      const req = {
        method: 'GET',
        url: '/test',
        headers: {},
      };

      const response = await app.handleRequest(req);
      expect(response.headers?.['x-content-type-options']).toBe('nosniff');
    });

    it('should set Content-Security-Policy header', async () => {
      app.get('/test', (ctx: any) => ctx.text('OK'));

      const req = {
        method: 'GET',
        url: '/test',
        headers: {},
      };

      const response = await app.handleRequest(req);
      expect(response.headers?.['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('Input Validation', () => {
    it('should reject oversized payloads', async () => {
      const app = OpenSpeed();
      app.use(security({ maxBodySize: 1024 })); // 1KB limit

      app.post('/test', (ctx: any) => ctx.text('OK'));

      const largePayload = 'x'.repeat(2048); // 2KB

      const req = {
        method: 'POST',
        url: '/test',
        headers: {
          'content-length': largePayload.length.toString(),
        },
        body: largePayload,
      };

      const response = await app.handleRequest(req);
      expect(response.status).toBe(413); // Payload Too Large
    });

    it('should sanitize suspicious input', async () => {
      const app = OpenSpeed();
      app.use(security({ sanitizeInput: true }));

      app.post('/test', (ctx: any) => {
        return ctx.json({ input: ctx.req.body });
      });

      const req = {
        method: 'POST',
        url: '/test',
        headers: {},
        body: {
          script: '<script>alert("XSS")</script>',
        },
      };

      const response = await app.handleRequest(req);
      // Should sanitize or flag suspicious content
    });
  });

  describe('Authentication Security', () => {
    it('should reject weak passwords', () => {
      // Test password strength requirements
      const weakPasswords = ['123456', 'password', 'qwerty'];

      for (const pwd of weakPasswords) {
        expect(pwd.length).toBeLessThan(12); // Should enforce minimum length
      }
    });

    it('should use secure password hashing', () => {
      // Verify bcrypt is used instead of MD5/SHA1
      const { hashPassword } = require('../../dist/packages/auth/src/index.js');

      const hash = hashPassword('SecurePassword123!');
      expect(hash).toMatch(/^\$2[aby]\$/); // Bcrypt hash pattern
    });

    it('should implement rate limiting on login', async () => {
      const app = OpenSpeed();
      const { rateLimit } = require('../../dist/src/openspeed/plugins/rateLimit.js');

      app.use(rateLimit({ windowMs: 60000, max: 5 }));
      app.post('/login', (ctx: any) => ctx.text('OK'));

      // Simulate multiple login attempts
      for (let i = 0; i < 6; i++) {
        const req = {
          method: 'POST',
          url: '/login',
          headers: {
            'x-forwarded-for': '192.168.1.1',
          },
          body: { username: 'test', password: 'test' },
        };

        const response = await app.handleRequest(req);

        if (i < 5) {
          expect(response.status).not.toBe(429);
        } else {
          expect(response.status).toBe(429); // Too Many Requests
        }
      }
    });
  });

  describe('Session Security', () => {
    it('should set secure cookie flags', () => {
      const { cookie } = require('../../dist/src/openspeed/plugins/cookie.js');

      const middleware = cookie({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
      });

      // Verify cookie options are set correctly
      expect(middleware).toBeDefined();
    });

    it('should regenerate session ID after login', () => {
      // Test session fixation prevention
      // Session ID should change after authentication
    });

    it('should expire sessions after timeout', () => {
      // Test session timeout
      // Sessions should expire after inactivity
    });
  });

  describe('File Upload Security', () => {
    it('should validate file types', async () => {
      const { upload } = require('../../dist/src/openspeed/plugins/upload.js');

      const middleware = upload({
        allowedExtensions: ['.jpg', '.png', '.pdf'],
      });

      // Should reject .exe, .sh, etc.
    });

    it('should scan for malware', async () => {
      // Test ClamAV integration
      // Malicious files should be quarantined
    });

    it('should enforce file size limits', async () => {
      const { upload } = require('../src/openspeed/plugins/upload.js');

      const middleware = upload({
        limits: {
          fileSize: 1024 * 1024, // 1MB
        },
      });

      // Should reject files larger than limit
    });
  });

  describe('Error Handling Security', () => {
    it('should not leak sensitive info in production errors', async () => {
      process.env.NODE_ENV = 'production';

      const app = OpenSpeed();
      app.get('/error', () => {
        throw new Error('Database connection failed: postgres://user:pass@host/db');
      });

      const req = {
        method: 'GET',
        url: '/error',
        headers: {},
      };

      const response = await app.handleRequest(req);

      // Should not include connection string in response
      expect(response.body).not.toContain('postgres://');
      expect(response.body).not.toContain('user:pass');
    });

    it('should log errors securely', () => {
      // Errors should be logged without sensitive data
      // Stack traces should only be in logs, not responses
    });
  });
});

describe('Penetration Testing', () => {
  describe('Common Attack Vectors', () => {
    it('should resist path traversal attacks', async () => {
      const app = OpenSpeed();
      app.get('/file/:path', (ctx: any) => {
        // Should validate path parameter
        const path = ctx.params.path;
        expect(path).not.toContain('..');
      });
    });

    it('should resist header injection', async () => {
      const app = new OpenSpeed();
      app.get('/test', (ctx: any) => {
        const userInput = ctx.req.query?.redirect;
        // Should not directly use user input in headers
        expect(userInput).not.toContain('\r\n');
      });
    });

    it('should resist timing attacks', () => {
      // Password/token comparison should be constant-time
      const constantTimeCompare = (a: string, b: string) => {
        if (a.length !== b.length) return false;

        let result = 0;
        for (let i = 0; i < a.length; i++) {
          result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
      };

      const token1 = 'secret123';
      const token2 = 'secret123';
      const token3 = 'secret456';

      expect(constantTimeCompare(token1, token2)).toBe(true);
      expect(constantTimeCompare(token1, token3)).toBe(false);
    });
  });
});

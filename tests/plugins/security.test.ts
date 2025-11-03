import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateCSRFToken } from '../../src/openspeed/plugins/security.js';

describe('security plugin - security enhancements', () => {
  const originalCsrfSecret = process.env.CSRF_SECRET;

  beforeEach(() => {
    // Set a valid CSRF secret for tests (32+ chars)
    process.env.CSRF_SECRET = 'test-csrf-secret-must-be-32-chars-minimum-length-required';
  });

  afterEach(() => {
    // Restore original environment
    if (originalCsrfSecret) {
      process.env.CSRF_SECRET = originalCsrfSecret;
    } else {
      delete process.env.CSRF_SECRET;
    }
  });

  describe('CSRF token generation', () => {
    it('should generate CSRF token with valid secret from env', () => {
      const token = generateCSRFToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes in hex = 64 chars
    });

    it('should generate CSRF token with explicit valid secret', () => {
      const secret = 'explicit-secret-must-be-32-chars-minimum-length-required';
      const token = generateCSRFToken(secret);
      expect(token).toBeDefined();
      expect(token.length).toBe(64);
    });

    it('should throw error when secret is missing', () => {
      delete process.env.CSRF_SECRET;
      expect(() => generateCSRFToken()).toThrow('SECURITY ERROR: CSRF secret is required');
    });

    it('should throw error when secret is too short', () => {
      const shortSecret = 'short'; // Less than 32 chars
      expect(() => generateCSRFToken(shortSecret)).toThrow(
        'SECURITY ERROR: CSRF secret must be at least 32 characters long'
      );
    });

    it('should generate different tokens each time', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      expect(token1).not.toBe(token2);
    });
  });
});

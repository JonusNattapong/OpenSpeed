import { describe, it, expect } from 'vitest';
import { generateCSRFToken } from '../../src/openspeed/plugins/security.js';

describe('security plugin - security enhancements', () => {
  describe('CSRF token generation', () => {
    it('should generate CSRF token', () => {
      const token = generateCSRFToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes in hex = 64 chars
    });

    it('should generate different tokens each time', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate tokens with only hex characters', () => {
      const token = generateCSRFToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate cryptographically secure tokens', () => {
      // Generate multiple tokens and ensure they're all different
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateCSRFToken());
      }
      expect(tokens.size).toBe(100); // All tokens should be unique
    });
  });
});

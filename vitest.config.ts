import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    clearMocks: true,
    testTimeout: 60000, // Increase test timeout to 60 seconds
    hookTimeout: 60000, // Increase hook timeout to 60 seconds
  }
});


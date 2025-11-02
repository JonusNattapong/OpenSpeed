import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,js}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        global: 'readonly',
        Buffer: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        // Web API globals
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',

      // General rules
      'no-console': 'off', // Allow console.log in examples/benchmarks
      'no-unused-vars': 'off', // Let TypeScript handle this
    },
  },
  // Bun runtime globals
  {
    files: ['src/openspeed/adapters/bun.ts'],
    languageOptions: {
      globals: {
        Bun: 'readonly',
      },
    },
  },
  // Deno runtime globals
  {
    files: ['src/openspeed/adapters/deno.ts'],
    languageOptions: {
      globals: {
        Deno: 'readonly',
      },
    },
  },
  // Cloudflare Workers globals
  {
    files: ['src/openspeed/adapters/cloudflare.ts'],
    languageOptions: {
      globals: {
        addEventListener: 'readonly',
      },
    },
  },
  // More lenient rules for examples and benchmarks
  {
    files: ['examples/**/*.{ts,js}', 'benchmarks/**/*.{ts,js}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: false, // Disable JSX parsing for examples
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'off', // Allow undefined globals in examples
    },
  },
  // More lenient rules for CLI code
  {
    files: ['src/cli/**/*.{ts,js}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'off', // CLI code often uses Node globals
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'benchmarks/results.json', '*.config.js', '.eslintrc*'],
  },
];

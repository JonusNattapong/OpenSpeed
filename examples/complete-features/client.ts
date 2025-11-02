/**
 * RPC Client Example for OpenSpeed
 * Demonstrates end-to-end type safety with the treaty client
 */

import { treaty, batch } from '../../src/openspeed/plugins/rpc.js';
import type { App } from './index.js';

// Create type-safe client
const api = treaty<App>('http://localhost:3000');

/**
 * Example 1: Basic GET request
 */
async function getUser() {
  console.log('📡 Fetching user...');

  const { data, error, status } = await api['/api/users/:id'].get({
    params: { id: '123' },
  });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✓ User data:', data);
}

/**
 * Example 2: POST request with validation
 */
async function createUser() {
  console.log('📡 Creating user...');

  const { data, error, status } = await api['/api/users'].post({
    body: {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      age: 28,
    },
  });

  if (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error.details);
    return;
  }

  console.log('✓ Created user:', data);
}

/**
 * Example 3: Validation error handling
 */
async function createInvalidUser() {
  console.log('📡 Attempting to create invalid user...');

  const { data, error, status } = await api['/api/users'].post({
    body: {
      name: 'A', // Too short - should fail validation
      email: 'invalid-email', // Invalid email format
      age: 15, // Too young - should fail validation
    },
  });

  if (error) {
    console.error('❌ Validation failed (expected):', error.message);
    console.error('Details:', error.details);
    return;
  }

  console.log('Unexpected success:', data);
}

/**
 * Example 4: Query parameters with validation
 */
async function searchWithQuery() {
  console.log('📡 Searching with query parameters...');

  const { data, error } = await api['/api/search'].get({
    query: {
      q: 'openspeed',
      limit: '10',
      offset: '0',
    },
  });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✓ Search results:', data);
}

/**
 * Example 5: Products list
 */
async function getProducts() {
  console.log('📡 Fetching products...');

  const { data, error } = await api['/api/products'].get();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✓ Products:', data);
}

/**
 * Example 6: Validated POST with query
 */
async function createWithValidation() {
  console.log('📡 Creating with validation...');

  const { data, error } = await api['/api/validated'].post({
    query: {
      format: 'json',
    },
    body: {
      title: 'My Post',
      content: 'This is a validated post',
      tags: ['openspeed', 'typescript', 'rpc'],
    },
  });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✓ Validated response:', data);
}

/**
 * Example 7: Batch requests
 */
async function batchRequests() {
  console.log('📡 Executing batch requests...');

  const results = await batch(
    api['/api/users/:id'].get({ params: { id: '1' } }),
    api['/api/users/:id'].get({ params: { id: '2' } }),
    api['/api/products'].get(),
    api['/health'].get()
  );

  console.log('✓ Batch results:');
  results.forEach((result, index) => {
    if (result.error) {
      console.log(`  ${index + 1}. Error: ${result.error.message}`);
    } else {
      console.log(`  ${index + 1}. Success:`, result.data);
    }
  });
}

/**
 * Example 8: Health check
 */
async function healthCheck() {
  console.log('📡 Checking server health...');

  const { data, error } = await api['/health'].get();

  if (error) {
    console.error('❌ Server unhealthy:', error.message);
    return;
  }

  console.log('✓ Server healthy:', data);
}

/**
 * Example 9: Custom headers
 */
async function withCustomHeaders() {
  console.log('📡 Request with custom headers...');

  const customApi = treaty<App>('http://localhost:3000', {
    headers: {
      'X-Custom-Header': 'MyValue',
      'Authorization': 'Bearer fake-token',
    },
  });

  const { data, error } = await customApi['/api/status'].get();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✓ Status:', data);
}

/**
 * Example 10: Error handling with hooks
 */
async function withHooks() {
  console.log('📡 Request with hooks...');

  const apiWithHooks = treaty<App>('http://localhost:3000', {
    onRequest: async (req) => {
      console.log('  → Request:', req.method, req.url);
    },
    onResponse: async (res) => {
      console.log('  ← Response:', res.status, res.statusText);
    },
    onError: async (error) => {
      console.log('  ✗ Error:', error.message);
    },
  });

  const { data } = await apiWithHooks['/api/products'].get();
  console.log('✓ Data:', data);
}

/**
 * Main execution
 */
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║  🚀 OpenSpeed RPC Client Example                         ║
║     End-to-End Type Safety Demo                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  try {
    // Run examples
    await healthCheck();
    console.log('\n' + '─'.repeat(60) + '\n');

    await getUser();
    console.log('\n' + '─'.repeat(60) + '\n');

    await createUser();
    console.log('\n' + '─'.repeat(60) + '\n');

    await createInvalidUser();
    console.log('\n' + '─'.repeat(60) + '\n');

    await searchWithQuery();
    console.log('\n' + '─'.repeat(60) + '\n');

    await getProducts();
    console.log('\n' + '─'.repeat(60) + '\n');

    await createWithValidation();
    console.log('\n' + '─'.repeat(60) + '\n');

    await batchRequests();
    console.log('\n' + '─'.repeat(60) + '\n');

    await withCustomHeaders();
    console.log('\n' + '─'.repeat(60) + '\n');

    await withHooks();

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║  ✅ All examples completed successfully!                  ║
║                                                           ║
║  Key takeaways:                                           ║
║  • Full type safety between client and server            ║
║  • No code generation required                           ║
║  • Runtime validation with Zod                           ║
║  • Error handling built-in                               ║
║  • Custom headers and hooks support                      ║
║  • Batch requests for parallel execution                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  getUser,
  createUser,
  createInvalidUser,
  searchWithQuery,
  getProducts,
  createWithValidation,
  batchRequests,
  healthCheck,
  withCustomHeaders,
  withHooks,
};

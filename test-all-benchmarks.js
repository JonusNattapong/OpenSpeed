#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const frameworks = ['openspeed', 'hono', 'elysia'];
const scenarios = ['routing', 'json', 'middleware', 'plugins', 'realworld'];
const results = {};

const PORT_BASE = 3000;

// Get port for framework and scenario
function getPort(framework, scenario) {
  const frameworkOffset = { openspeed: 0, hono: 100, elysia: 200 }[framework] || 0;
  const scenarioOffset = scenarios.indexOf(scenario);
  return PORT_BASE + frameworkOffset + scenarioOffset;
}

// Start server for specific framework/scenario
function startServer(framework, scenario) {
  const port = getPort(framework, scenario);
  const appPath = path.join(__dirname, 'benchmarks', 'apps', `${framework}-${scenario}.ts`);

  console.log(`Starting ${framework} ${scenario} server on port ${port}`);

  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return exec(`${npxCmd} tsx ${appPath} ${port}`, { stdio: ['ignore', 'ignore', 'ignore'] });
}

// Wait for server to be ready
async function waitForServer(port, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await makeRequest(port, '/health');
      console.log(`Server on port ${port} is ready`);
      return;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Server on port ${port} didn't start within ${timeout}ms`);
}

// Make HTTP request
function makeRequest(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Run performance test
async function runPerformanceTest(port, scenario) {
  const endpoints = getTestEndpoints(scenario);
  const results = {};

  for (const endpoint of endpoints) {
    console.log(`Testing ${endpoint} on port ${port}`);
    const times = [];

    // Run 50 requests for each endpoint
    for (let i = 0; i < 50; i++) {
      const start = Date.now();
      try {
        await makeRequest(port, endpoint);
        const end = Date.now();
        times.push(end - start);
      } catch (e) {
        console.log(`Request failed: ${e.message}`);
        times.push(1000); // Penalize failed requests
      }
    }

    const avg = times.reduce((a, b) => a + b) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    results[endpoint] = { avg, min, max, p95, requests: times.length };
  }

  return results;
}

// Get test endpoints for scenario
function getTestEndpoints(scenario) {
  switch (scenario) {
    case 'routing':
      return ['/', '/user/123', '/api/v1/users/123/posts/456', '/search?q=test'];
    case 'json':
      return ['/json-response?size=100'];
    case 'middleware':
      return ['/single-middleware', '/multiple-middlewares', '/authenticated'];
    case 'plugins':
      return ['/single-plugin', '/multiple-plugins', '/authenticated'];
    case 'realworld':
      return ['/api/articles', '/api/tags'];
    default:
      return ['/'];
  }
}

// Stop server
function stopServer(server) {
  if (server && server.kill) {
    server.kill();
  }
}

// Main test function
async function runAllTests() {
  console.log('🚀 Starting Comprehensive Benchmark Suite\n');
  console.log('Testing frameworks:', frameworks.join(', '));
  console.log('Testing scenarios:', scenarios.join(', '));
  console.log('='.repeat(80), '\n');

  for (const framework of frameworks) {
    results[framework] = {};
    console.log(`🔧 Testing ${framework.toUpperCase()}\n`);

    for (const scenario of scenarios) {
      try {
        console.log(`📈 Running ${scenario} scenario...`);

        // Start server
        const server = startServer(framework, scenario);
        const port = getPort(framework, scenario);

        // Wait for server
        await waitForServer(port);

        // Run performance test
        const testResults = await runPerformanceTest(port, scenario);
        results[framework][scenario] = testResults;

        // Stop server
        stopServer(server);

        console.log(`✅ ${scenario} completed\n`);

      } catch (error) {
        console.log(`❌ ${scenario} failed: ${error.message}\n`);
        results[framework][scenario] = null;
      }
    }
  }

  // Generate report
  generateReport();
}

// Generate comprehensive report
function generateReport() {
  console.log('\n📊 BENCHMARK RESULTS REPORT');
  console.log('='.repeat(80));

  // Summary table
  console.log('\n🎯 PERFORMANCE SUMMARY (Average Latency in ms)');
  console.log('-'.repeat(80));
  console.log('Scenario'.padEnd(12), 'OpenSpeed'.padEnd(12), 'Hono'.padEnd(12), 'Elysia'.padEnd(12));
  console.log('-'.repeat(80));

  for (const scenario of scenarios) {
    const openspeed = results.openspeed[scenario];
    const hono = results.hono[scenario];
    const elysia = results.elysia[scenario];

    const getAvg = (data) => {
      if (!data) return 'N/A';
      const totals = Object.values(data).map(r => r.avg);
      return (totals.reduce((a, b) => a + b) / totals.length).toFixed(1);
    };

    console.log(
      scenario.padEnd(12),
      getAvg(openspeed).padEnd(12),
      getAvg(hono).padEnd(12),
      getAvg(elysia).padEnd(12)
    );
  }

  // Detailed results
  console.log('\n📋 DETAILED RESULTS');
  console.log('='.repeat(80));

  for (const scenario of scenarios) {
    console.log(`\n🎯 ${scenario.toUpperCase()} Scenario`);
    console.log('-'.repeat(40));

    for (const framework of frameworks) {
      const data = results[framework][scenario];
      if (data) {
        console.log(`\n${framework.toUpperCase()}:`);
        for (const [endpoint, metrics] of Object.entries(data)) {
          console.log(`  ${endpoint}:`);
          console.log(`    Avg: ${metrics.avg.toFixed(1)}ms`);
          console.log(`    Min: ${metrics.min.toFixed(1)}ms`);
          console.log(`    Max: ${metrics.max.toFixed(1)}ms`);
          console.log(`    P95: ${metrics.p95.toFixed(1)}ms`);
        }
      } else {
        console.log(`${framework.toUpperCase()}: Failed`);
      }
    }
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('='.repeat(80));

  const fastest = {};
  for (const scenario of scenarios) {
    let bestFramework = null;
    let bestAvg = Infinity;

    for (const framework of frameworks) {
      const data = results[framework][scenario];
      if (data) {
        const avg = Object.values(data).reduce((sum, r) => sum + r.avg, 0) / Object.keys(data).length;
        if (avg < bestAvg) {
          bestAvg = avg;
          bestFramework = framework;
        }
      }
    }

    fastest[scenario] = bestFramework;
    console.log(`${scenario}: ${bestFramework || 'N/A'} (fastest)`);
  }

  console.log('\n✅ Benchmark suite completed!');
  console.log(`Total scenarios tested: ${scenarios.length * frameworks.length}`);
  console.log(`Successful tests: ${Object.values(results).flatMap(f => Object.values(f)).filter(r => r !== null).length}`);
}

// Run the tests
runAllTests().catch(console.error);

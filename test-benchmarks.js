#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import http from 'http';

const frameworks = ['openspeed', 'hono', 'elysia'];
const scenarios = ['routing', 'json'];
const results = {};

async function runBenchmark(framework, scenario) {
  const port = getPort(framework, scenario);
  const appPath = `benchmarks/apps/${framework}-${scenario}.ts`;

  console.log(`Testing ${framework} ${scenario} on port ${port}`);

  // Start server
  const server = startServer(framework, appPath, port);

  // Wait for server to be ready
  await waitForServer(port);

  // Run tests
  const testResults = await runTests(port, scenario);

  // Kill server
  server.kill();

  return testResults;
}

function startServer(framework, appPath, port) {
  let command;
  if (framework === 'openspeed' || framework === 'hono' || framework === 'elysia') {
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    command = `${npxCmd} tsx ${appPath} ${port}`;
  }

  return exec(command, { stdio: ['ignore', 'ignore', 'ignore'] });
}

function getPort(framework, scenario) {
  const basePorts = { openspeed: 3000, hono: 3100, elysia: 3200 };
  const scenarioOffsets = { routing: 0, json: 1 };
  return basePorts[framework] + scenarioOffsets[scenario];
}

async function waitForServer(port, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await makeRequest(port, '/health');
      return;
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Server on port ${port} didn't start`);
}

async function runTests(port, scenario) {
  const endpoints =
    scenario === 'routing' ? ['/', '/user/123', '/api/v1/users/123/posts/456'] : ['/json'];

  const results = [];

  for (const endpoint of endpoints) {
    const times = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await makeRequest(port, endpoint);
      const end = Date.now();
      times.push(end - start);
    }
    const avg = times.reduce((a, b) => a + b) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    results.push({ endpoint, avg, min, max });
  }

  return results;
}

function makeRequest(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function main() {
  console.log('🚀 Simple Benchmark Test\n');

  for (const framework of frameworks) {
    results[framework] = {};
    for (const scenario of scenarios) {
      try {
        const testResults = await runBenchmark(framework, scenario);
        results[framework][scenario] = testResults;
        console.log(`✅ ${framework} ${scenario}: ${testResults.length} tests completed`);
      } catch (error) {
        console.log(`❌ ${framework} ${scenario}: ${error.message}`);
        results[framework][scenario] = null;
      }
    }
  }

  // Print summary
  console.log('\n📊 Results Summary\n');
  console.log('='.repeat(60));

  for (const scenario of scenarios) {
    console.log(`\n🎯 ${scenario.toUpperCase()}`);
    console.log('-'.repeat(40));

    for (const framework of frameworks) {
      const data = results[framework][scenario];
      if (data) {
        const avgLatency = data.reduce((sum, test) => sum + test.avg, 0) / data.length;
        console.log(`${framework.padEnd(10)}: ${avgLatency.toFixed(2)}ms avg latency`);
      } else {
        console.log(`${framework.padEnd(10)}: Failed`);
      }
    }
  }

  console.log('\n✅ Benchmark test completed!');
}

main().catch(console.error);

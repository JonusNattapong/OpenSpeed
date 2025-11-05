#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const frameworks = ['openspeed', 'hono', 'elysia'];
const scenarios = ['routing', 'json'];
const runtime = 'node'; // Only test Node.js for now

class SimpleBenchmarkRunner {
  async runComparison() {
    console.log('🚀 Simple Framework Comparison\n');

    const results = {};

    for (const framework of frameworks) {
      console.log(`\n🔧 Testing ${framework.toUpperCase()}`);
      results[framework] = {};

      for (const scenario of scenarios) {
        console.log(`  📈 Scenario: ${scenario}`);
        const result = await this.runBenchmark(framework, scenario);
        results[framework][scenario] = result;
        this.printResult(result);
      }
    }

    this.printComparison(results);
  }

  async runBenchmark(framework, scenario) {
    const appPath = join('benchmarks', 'apps', `${framework}-${scenario}.ts`);

    try {
      // Start server
      const server = this.startServer(framework, scenario);

      // Wait for server to be ready
      await this.waitForServer(3000);

      // Run load test
      const loadTestResult = await this.runLoadTest(scenario);

      // Kill server
      server.kill();

      return loadTestResult;
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      return {
        latency: { average: 0, p50: 0, p95: 0, p99: 0 },
        throughput: { average: 0, total: 0 },
      };
    }
  }

  startServer(framework, scenario) {
    const appPath = join('benchmarks', 'apps', `${framework}-${scenario}.ts`);
    // Use local tsx from node_modules
    const tsxPath = join(
      process.cwd(),
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
    );
    const cmd = [tsxPath, appPath, '3000'];
    return spawn(cmd[0], cmd.slice(1), { stdio: ['ignore', 'ignore', 'ignore'] });
  }

  async waitForServer(port, timeout = 5000) {
    const start = Date.now();
    const http = await import('http');

    while (Date.now() - start < timeout) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(`http://localhost:${port}/health`, { timeout: 1000 }, (res) => {
            if (res.statusCode === 200) {
              resolve(void 0);
            } else {
              reject(new Error(`Status: ${res.statusCode}`));
            }
          });
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
          });
        });
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    throw new Error(`Server on port ${port} didn't start within ${timeout}ms`);
  }

  async runLoadTest(scenario) {
    const connections = scenario === 'routing' ? 100 : 50;
    const duration = 5; // 5 seconds for quick testing

    let autocannonArgs;

    if (scenario === 'routing') {
      autocannonArgs = [
        'autocannon',
        '-c',
        connections.toString(),
        '-d',
        duration.toString(),
        '-j',
        'http://localhost:3000/',
      ];
    } else if (scenario === 'json') {
      autocannonArgs = [
        'autocannon',
        '-c',
        connections.toString(),
        '-d',
        duration.toString(),
        '-m',
        'POST',
        '-H',
        'Content-Type: application/json',
        '-b',
        '{"message":"hello","data":[1,2,3,4,5]}',
        '-j',
        'http://localhost:3000/json',
      ];
    }

    try {
      // Use local autocannon from node_modules
      const autocannonPath = join(
        process.cwd(),
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'autocannon.cmd' : 'autocannon'
      );
      const result = await this.runCommand([autocannonPath, ...autocannonArgs.slice(1)]);
      return JSON.parse(result);
    } catch (error) {
      console.log(`Load test failed: ${error.message}`);
      return {
        latency: { average: 0, p50: 0, p95: 0, p99: 0 },
        throughput: { average: 0, total: 0 },
      };
    }
  }

  async runCommand(args) {
    return new Promise((resolve, reject) => {
      const child = spawn(args[0], args.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  printResult(result) {
    console.log(`      ⚡ Latency: ${result.latency.average.toFixed(2)}ms avg`);
    console.log(`      📊 Throughput: ${(result.throughput.average / 1024).toFixed(2)} KB/s`);
  }

  printComparison(results) {
    console.log('\n📊 COMPARISON RESULTS\n');
    console.log('='.repeat(60));

    for (const scenario of scenarios) {
      console.log(`\n🎯 Scenario: ${scenario.toUpperCase()}`);
      console.log('-'.repeat(40));
      console.log('Framework    | Latency (ms) | Throughput (KB/s)');
      console.log('-------------|--------------|-------------------');

      for (const framework of frameworks) {
        const result = results[framework][scenario];
        console.log(
          `${framework.padEnd(12)} | ${result.latency.average.toFixed(1).padStart(12)} | ${(result.throughput.average / 1024).toFixed(1).padStart(17)}`
        );
      }
    }

    // Find winners
    console.log('\n🏆 WINNERS');
    for (const scenario of scenarios) {
      const frameworkResults = frameworks.map((f) => ({
        framework: f,
        latency: results[f][scenario].latency.average,
        throughput: results[f][scenario].throughput.average,
      }));

      const fastest = frameworkResults.reduce((prev, curr) =>
        prev.latency < curr.latency ? prev : curr
      );

      const mostEfficient = frameworkResults.reduce((prev, curr) =>
        prev.throughput > curr.throughput ? prev : curr
      );

      console.log(`\n${scenario.toUpperCase()}:`);
      console.log(`  Fastest: ${fastest.framework} (${fastest.latency.toFixed(1)}ms)`);
      console.log(
        `  Most Efficient: ${mostEfficient.framework} (${(mostEfficient.throughput / 1024).toFixed(1)} KB/s)`
      );
    }
  }
}

// Run the comparison
const runner = new SimpleBenchmarkRunner();
runner.runComparison().catch(console.error);

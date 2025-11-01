#!/usr/bin/env node

import { spawn, execSync, exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const frameworks = ['openspeed', 'hono', 'elysia'];
const runtimes = ['node', 'bun'];
const scenarios = ['routing', 'json', 'middleware', 'plugins', 'real-world'];

interface BenchmarkResult {
  framework: string;
  runtime: string;
  scenario: string;
  duration: number;
  connections: number;
  latency: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    average: number;
    total: number;
  };
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  startupTime: number;
}

class BenchmarkRunner {
  private results: BenchmarkResult[] = [];

  async runAllBenchmarks() {
    console.log('🚀 Starting Comprehensive Framework Benchmark\n');

    for (const runtime of runtimes) {
      console.log(`📊 Testing with ${runtime.toUpperCase()}\n`);

      for (const framework of frameworks) {
        console.log(`  🔧 Framework: ${framework.toUpperCase()}`);

        for (const scenario of scenarios) {
          console.log(`    📈 Scenario: ${scenario}`);
          const result = await this.runBenchmark(framework, runtime, scenario);
          this.results.push(result);
          this.printResult(result);
        }
        console.log('');
      }
    }

    this.generateReport();
  }

  private async runBenchmark(
    framework: string,
    runtime: string,
    scenario: string
  ): Promise<BenchmarkResult> {
    const appPath = join('benchmarks', 'apps', `${framework}-${scenario}.ts`);

    if (!existsSync(appPath)) {
      console.log(`    ⚠️  Skipping ${framework}-${scenario} (app not found)`);
      return this.createEmptyResult(framework, runtime, scenario);
    }

    try {
      // Measure startup time
      const startupStart = Date.now();
      const server = this.startServer(framework, runtime, scenario);
      const startupTime = Date.now() - startupStart;

      // Wait for server to be ready
      await this.waitForServer(3000 + this.getPortOffset(framework, scenario));

      // Run load test
      const port = 3000 + this.getPortOffset(framework, scenario);
      const loadTestResult = await this.runLoadTest(port, scenario);

      // Measure memory usage (simplified)
      const memoryUsage = { rss: 0, heapUsed: 0, heapTotal: 0 };

      server.kill();

      return {
        framework,
        runtime,
        scenario,
        duration: 10, // 10 seconds test
        connections: this.getConnectionsForScenario(scenario),
        latency: loadTestResult.latency,
        throughput: loadTestResult.throughput,
        memory: memoryUsage,
        startupTime,
      };
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      return this.createEmptyResult(framework, runtime, scenario);
    }
  }

  private startServer(framework: string, runtime: string, scenario: string) {
    const port = 3000 + this.getPortOffset(framework, scenario);
    const appPath = join('benchmarks', 'apps', `${framework}-${scenario}.ts`);

    let cmd: string[];
    if (runtime === 'bun') {
      cmd = ['bun', 'run', appPath, port.toString()];
    } else {
      cmd = [process.platform === 'win32' ? 'npx.cmd' : 'npx', 'tsx', appPath, port.toString()];
    }

    return spawn(cmd[0], cmd.slice(1), { stdio: ['ignore', 'ignore', 'ignore'] });
  }

  private async waitForServer(port: number, timeout = 10000): Promise<void> {
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

  private async runLoadTest(port: number, scenario: string) {
    const connections = this.getConnectionsForScenario(scenario);
    const duration = 10; // 10 seconds

    let autocannonArgs: string[];

    switch (scenario) {
      case 'routing':
        autocannonArgs = [
          'autocannon',
          '-c',
          connections.toString(),
          '-d',
          duration.toString(),
          '-j',
          `http://localhost:${port}/`,
        ];
        break;
      case 'json':
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
          `http://localhost:${port}/json`,
        ];
        break;
      case 'middleware':
        autocannonArgs = [
          'autocannon',
          '-c',
          connections.toString(),
          '-d',
          duration.toString(),
          '-j',
          `http://localhost:${port}/multiple-middlewares`,
        ];
        break;
      case 'plugins':
        autocannonArgs = [
          'autocannon',
          '-c',
          connections.toString(),
          '-d',
          duration.toString(),
          '-j',
          `http://localhost:${port}/multiple-plugins`,
        ];
        break;
      case 'real-world':
        autocannonArgs = [
          'autocannon',
          '-c',
          connections.toString(),
          '-d',
          duration.toString(),
          '-j',
          `http://localhost:${port}/api/users`,
        ];
        break;
      default:
        autocannonArgs = [
          'autocannon',
          '-c',
          connections.toString(),
          '-d',
          duration.toString(),
          '-j',
          `http://localhost:${port}/`,
        ];
    }

    try {
      const result = await this.runCommand(['npx', ...autocannonArgs]);
      return JSON.parse(result);
    } catch (error) {
      console.log(`Load test failed: ${error.message}`);
      return {
        latency: { average: 0, p50: 0, p95: 0, p99: 0 },
        throughput: { average: 0, total: 0 },
      };
    }
  }

  private async runCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const child = spawn(cmd, args.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });

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

  private async getMemoryUsage(pid: number) {
    try {
      // This is a simplified version - in real implementation you'd use process.memoryUsage()
      return {
        rss: 0,
        heapUsed: 0,
        heapTotal: 0,
      };
    } catch {
      return { rss: 0, heapUsed: 0, heapTotal: 0 };
    }
  }

  private getPortOffset(framework: string, scenario: string): number {
    const frameworkOffset = { openspeed: 0, hono: 100, elysia: 200 }[framework] || 0;
    const scenarioOffset = scenarios.indexOf(scenario);
    return frameworkOffset + scenarioOffset;
  }

  private getConnectionsForScenario(scenario: string): number {
    const connections = {
      routing: 100,
      json: 50,
      middleware: 75,
      plugins: 75,
      'real-world': 100,
    };
    return connections[scenario] || 50;
  }

  private createEmptyResult(framework: string, runtime: string, scenario: string): BenchmarkResult {
    return {
      framework,
      runtime,
      scenario,
      duration: 10,
      connections: this.getConnectionsForScenario(scenario),
      latency: { average: 0, p50: 0, p95: 0, p99: 0 },
      throughput: { average: 0, total: 0 },
      memory: { rss: 0, heapUsed: 0, heapTotal: 0 },
      startupTime: 0,
    };
  }

  private printResult(result: BenchmarkResult) {
    console.log(
      `      ⚡ Latency: ${result.latency.average.toFixed(2)}ms avg, ${result.latency.p95.toFixed(2)}ms p95`
    );
    console.log(`      📊 Throughput: ${(result.throughput.average / 1024).toFixed(2)} KB/s`);
    console.log(`      🧠 Memory: ${(result.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`      🚀 Startup: ${result.startupTime}ms`);
  }

  private generateReport() {
    console.log('\n📊 BENCHMARK REPORT\n');
    console.log('='.repeat(80));

    // Group by scenario
    for (const scenario of scenarios) {
      console.log(`\n🎯 Scenario: ${scenario.toUpperCase()}`);
      console.log('-'.repeat(40));

      for (const runtime of runtimes) {
        console.log(`\nRuntime: ${runtime.toUpperCase()}`);
        console.log('Framework    | Latency (ms) | Throughput (KB/s) | Memory (MB) | Startup (ms)');
        console.log('-------------|--------------|-------------------|-------------|-------------');

        const scenarioResults = this.results.filter(
          (r) => r.scenario === scenario && r.runtime === runtime
        );

        scenarioResults.forEach((result) => {
          console.log(
            `${result.framework.padEnd(12)} | ${result.latency.average.toFixed(1).padStart(12)} | ${(result.throughput.average / 1024).toFixed(1).padStart(17)} | ${(result.memory.heapUsed / 1024 / 1024).toFixed(1).padStart(11)} | ${result.startupTime.toString().padStart(11)}`
          );
        });
      }
    }

    // Save detailed results
    writeFileSync(
      'benchmarks/results.json',
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          results: this.results,
          summary: this.generateSummary(),
        },
        null,
        2
      )
    );

    console.log('\n💾 Detailed results saved to benchmarks/results.json');
  }

  private generateSummary() {
    const summary = {
      fastest: {},
      mostEfficient: {},
      lowestMemory: {},
      quickestStartup: {},
    };

    for (const scenario of scenarios) {
      for (const runtime of runtimes) {
        const results = this.results.filter(
          (r) => r.scenario === scenario && r.runtime === runtime && r.latency.average > 0
        );

        if (results.length === 0) continue;

        // Fastest (lowest latency)
        const fastest = results.reduce((prev, curr) =>
          prev.latency.average < curr.latency.average ? prev : curr
        );

        // Most efficient (highest throughput)
        const mostEfficient = results.reduce((prev, curr) =>
          prev.throughput.average > curr.throughput.average ? prev : curr
        );

        // Lowest memory
        const lowestMemory = results.reduce((prev, curr) =>
          prev.memory.heapUsed < curr.memory.heapUsed ? prev : curr
        );

        // Quickest startup
        const quickestStartup = results.reduce((prev, curr) =>
          prev.startupTime < curr.startupTime ? prev : curr
        );

        summary.fastest[`${scenario}_${runtime}`] = fastest.framework;
        summary.mostEfficient[`${scenario}_${runtime}`] = mostEfficient.framework;
        summary.lowestMemory[`${scenario}_${runtime}`] = lowestMemory.framework;
        summary.quickestStartup[`${scenario}_${runtime}`] = quickestStartup.framework;
      }
    }

    return summary;
  }
}

// Run benchmarks
const runner = new BenchmarkRunner();
runner.runAllBenchmarks().catch(console.error);

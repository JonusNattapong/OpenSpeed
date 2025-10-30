#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { readFileSync } from 'fs';

const runtime = process.argv[2] || 'node';
const duration = process.argv[3] || '10';
const connections = process.argv[4] || '100';

console.log(`Benchmarking OpenSpeed with ${runtime}`);
console.log(`Duration: ${duration}s, Connections: ${connections}`);

try {
  // Start server
  const serverCmd = runtime === 'bun' ? ['bun', 'run', 'benchmarks/app.ts'] : ['npx', 'tsx', 'benchmarks/app.ts'];
  console.log(`Starting server: ${serverCmd.join(' ')}`);

  const server = spawn(serverCmd[0], serverCmd.slice(1), { stdio: 'inherit' });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Run autocannon
  const autocannonCmd = `npx autocannon -c ${connections} -d ${duration} http://localhost:3000/`;
  console.log(`Running: ${autocannonCmd}`);

  const result = execSync(autocannonCmd, { encoding: 'utf8' });
  console.log(result);

  // JSON endpoint
  const jsonCmd = `npx autocannon -c ${connections} -d ${duration} -m POST -H "Content-Type: application/json" -b '{"test": "data"}' http://localhost:3000/json`;
  console.log(`Running JSON: ${jsonCmd}`);

  const jsonResult = execSync(jsonCmd, { encoding: 'utf8' });
  console.log(jsonResult);

  server.kill();

} catch (err) {
  console.error('Benchmark failed:', err.message);
}
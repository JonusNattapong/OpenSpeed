#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const projectName = process.argv[2] || 'my-openspeed-app';

console.log(`Creating OpenSpeed app: ${projectName}`);

mkdirSync(projectName);
process.chdir(projectName);

// package.json
const pkg = {
  name: projectName,
  version: '0.1.0',
  type: 'module',
  scripts: {
    dev: 'tsx src/index.ts',
    build: 'tsc',
    start: 'node dist/index.js'
  },
  dependencies: {
    openspeed: '^0.1.0',
    zod: '^3.0.0'
  },
  devDependencies: {
    typescript: '^5.0.0',
    tsx: '^4.0.0'
  }
};

writeFileSync('package.json', JSON.stringify(pkg, null, 2));

// tsconfig.json
const tsconfig = {
  compilerOptions: {
    target: 'ES2022',
    module: 'ES2022',
    strict: true,
    esModuleInterop: true,
    outDir: 'dist'
  },
  include: ['src/**/*']
};

writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2));

// src/index.ts
const indexTs = `import { createApp, cors, logger, json, validate, openapi } from 'openspeed';
import { z } from 'zod';

const app = createApp();

const api = openapi({ title: '${projectName} API', version: '1.0.0' });

app.use(cors());
app.use(logger());
app.use(json());
app.use(api.middleware);

app.get('/', (ctx) => {
  return ctx.text('Hello ${projectName}!');
});
api.collect('GET', '/', 'Get hello message');

app.get('/user/:id', validate({ params: z.object({ id: z.string() }) }), (ctx) => {
  return ctx.json({ id: ctx.params.id });
});
api.collect('GET', '/user/:id', 'Get user by ID');

await app.listen(3000);
console.log('${projectName} listening on http://localhost:3000');
console.log('OpenAPI spec at http://localhost:3000/openapi.json');
`;

mkdirSync('src');
writeFileSync('src/index.ts', indexTs);

// README
const readme = `# ${projectName}

Created with OpenSpeed CLI.

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`
`;

writeFileSync('README.md', readme);

console.log('Installing dependencies...');
execSync('npm install', { stdio: 'inherit' });

console.log('Done! Run:');
console.log(`cd ${projectName}`);
console.log('npm run dev');
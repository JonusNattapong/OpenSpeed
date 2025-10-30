#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

interface CliOptions {
  template: 'basic';
  force: boolean;
}

interface TemplateContext {
  projectName: string;
  packageName: string;
}

const DEFAULT_OPTIONS: CliOptions = {
  template: 'basic',
  force: false
};

const TEMPLATE_FILES: Record<string, (ctx: TemplateContext) => string> = {
  'package.json': ({ packageName }) =>
    `{
  "name": "${packageName}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --project tsconfig.json",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "openspeed": "latest"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
`,
  'tsconfig.json': () =>
    `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
`,
  '.gitignore': () =>
    `node_modules
dist
.DS_Store
`,
  'README.md': ({ projectName }) =>
    `# ${projectName}

Generated with \`create-openspeed-app\`.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Then open [http://localhost:3000](http://localhost:3000).

## Build for production

\`\`\`bash
npm run build
npm run start
\`\`\`
`,
  'src/index.ts': () =>
    `import { createApp, json, logger, errorHandler } from 'openspeed';

const app = createApp();

app.use(logger());
app.use(json());
app.use(errorHandler());

app.get('/', (ctx) => ctx.json({ message: 'Hello from OpenSpeed!' }));

app.listen(3000).then(() => {
  console.log('🚀 OpenSpeed app running at http://localhost:3000');
});
`
};

function parseArgs(argv: string[]): { target: string; options: CliOptions } {
  const args = [...argv];
  const options: CliOptions = { ...DEFAULT_OPTIONS };
  const positional: string[] = [];

  while (args.length) {
    const arg = args.shift()!;
    switch (arg) {
      case '--template':
      case '-t': {
        const value = args.shift();
        if (!value) throw new Error('Missing value for --template');
        options.template = value as CliOptions['template'];
        break;
      }
      case '--force':
      case '-f':
        options.force = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        positional.push(arg);
    }
  }

  const target = positional[0] || 'openspeed-app';
  return { target, options };
}

function printHelp() {
  console.log(`Usage: create-openspeed-app [dir] [options]

Options:
  -t, --template <name>  Template to use (default: basic)
  -f, --force            Overwrite target directory if not empty
  -h, --help             Show this help message
`);
}

function sanitizePackageName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+/i, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '') || 'openspeed-app';
}

function ensureDirectory(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function isEmpty(dir: string) {
  return !existsSync(dir) || readdirSync(dir).length === 0;
}

function writeProjectFiles(targetDir: string, ctx: TemplateContext) {
  for (const [relativePath, templateFn] of Object.entries(TEMPLATE_FILES)) {
    const filePath = path.join(targetDir, relativePath);
    ensureDirectory(path.dirname(filePath));
    writeFileSync(filePath, templateFn(ctx), 'utf8');
  }
}

function logNextSteps(targetDir: string, projectName: string) {
  const relative = path.relative(process.cwd(), targetDir);
  const needsCd = relative !== '' && relative !== '.';

  console.log('\n✅ Project scaffolded successfully!');
  if (needsCd) {
    console.log(`\nNext steps:\n  cd ${relative}\n  npm install\n  npm run dev`);
  } else {
    console.log('\nNext steps:\n  npm install\n  npm run dev');
  }
}

function main() {
  try {
    const { target, options } = parseArgs(process.argv.slice(2));
    const targetDir = path.resolve(process.cwd(), target);
    const projectName = path.basename(targetDir);

    if (options.template !== 'basic') {
      console.error(`❌ Unknown template "${options.template}". Available templates: basic`);
      process.exit(1);
    }

    if (!options.force && !isEmpty(targetDir)) {
      console.error(`❌ Directory "${projectName}" already exists and is not empty. Use --force to overwrite.`);
      process.exit(1);
    }

    ensureDirectory(targetDir);

    const ctx: TemplateContext = {
      projectName,
      packageName: sanitizePackageName(projectName)
    };

    writeProjectFiles(targetDir, ctx);
    logNextSteps(targetDir, projectName);
  } catch (err: any) {
    console.error(`❌ ${err.message || err}`);
    process.exit(1);
  }
}

main();

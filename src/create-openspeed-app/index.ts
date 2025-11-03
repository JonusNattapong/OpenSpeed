#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { input, select } from '@inquirer/prompts';

const LOGO = `
 ██████╗ ██████╗ ███████╗███╗   ██╗███████╗██████╗ ███████╗███████╗██████╗
██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔══██╗██╔════╝██╔════╝██╔══██╗
██║   ██║██████╔╝█████╗  ██╔██╗ ██║███████╗██████╔╝█████╗  █████╗  ██║  ██║
██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║╚════██║██╔═══╝ ██╔══╝  ██╔══╝  ██║  ██║
╚██████╔╝██║     ███████╗██║ ╚████║███████║██║     ███████╗███████╗██████╔╝
 ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚══════╝╚═╝     ╚══════╝╚══════╝╚═════╝

Welcome to OpenSpeed
`;

interface CliOptions {
  template: 'basic' | 'api';
  force: boolean;
}

interface TemplateContext {
  projectName: string;
  packageName: string;
}

const DEFAULT_OPTIONS: CliOptions = {
  template: 'basic',
  force: false,
};

const TEMPLATES: Record<string, Record<string, (ctx: TemplateContext) => string>> = {
  basic: {
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
    'src/index.ts': ({ projectName }) =>
      `import { createApp, json, logger, errorHandler } from 'openspeed';

  const LOGO = \`
 ██████╗ ██████╗ ███████╗███╗   ██╗███████╗██████╗ ███████╗███████╗██████╗
██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔══██╗██╔════╝██╔════╝██╔══██╗
██║   ██║██████╔╝█████╗  ██╔██╗ ██║███████╗██████╔╝█████╗  █████╗  ██║  ██║
██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║╚════██║██╔═══╝ ██╔══╝  ██╔══╝  ██║  ██║
╚██████╔╝██║     ███████╗██║ ╚████║███████║██║     ███████╗███████╗██████╔╝
 ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚══════╝╚═╝     ╚══════╝╚══════╝╚═════╝

  \`;

  const app = createApp();

  app.use(logger());
  app.use(json());
  app.use(errorHandler());

  app.get('/', (ctx) => ctx.json({ message: 'Hello from OpenSpeed!' }));

  app.listen(3000).then(() => {
    console.log(LOGO);
    console.log(\`🚀 ${projectName} is running at http://localhost:3000\`);
    console.log(\`📖 Documentation: https://github.com/JonusNattapong/OpenSpeed\`);
    console.log(\`🐛 Issues: https://github.com/JonusNattapong/OpenSpeed/issues\`);
  });
  `,
  },
  api: {
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
    "openspeed": "latest",
    "zod": "^3.22.0"
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
      `# ${projectName} API

Generated with \`create-openspeed-app\`.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

API will be available at [http://localhost:3000](http://localhost:3000).

## Endpoints

- GET / - Health check
- GET /api/users - List users
- POST /api/users - Create user
- GET /api/users/:id - Get user by ID

## Build for production

\`\`\`bash
npm run build
npm run start
\`\`\`
`,
    'src/index.ts': ({ projectName }) =>
      `import { createApp, json, logger, errorHandler, validate, cors } from 'openspeed';
import { z } from 'zod';

const app = createApp();

app.use(cors());
app.use(logger());
app.use(json());
app.use(errorHandler());

// In-memory storage (replace with database in production)
let users: Array<{ id: number; name: string; email: string }> = [
  { id: 1, name: 'John Doe', email: 'john@example.com' }
];
let nextId = 2;

// Health check
app.get('/', (ctx) => ctx.json({ message: 'Welcome to ${projectName} API', version: '1.0.0' }));

// Get all users
app.get('/api/users', (ctx) => ctx.json(users));

// Create user
// NOTE: In production, add CSRF protection middleware: app.use(csrf())
app.post('/api/users', validate({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email()
  })
}), (ctx) => {
  const { name, email } = ctx.req.body;
  const user = { id: nextId++, name, email };
  users.push(user);
  ctx.res.status = 201;
  return ctx.json(user);
});

// Get user by ID
app.get('/api/users/:id', validate({
  params: z.object({ id: z.string().regex(/^\\d+$/) })
}), (ctx) => {
  const id = parseInt(ctx.params.id);
  const user = users.find(u => u.id === id);
  if (!user) {
    ctx.res.status = 404;
    return ctx.json({ error: 'User not found' });
  }
  return ctx.json(user);
});

// Update user
// NOTE: In production, add CSRF protection middleware: app.use(csrf())
app.put('/api/users/:id', validate({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  body: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional()
  })
}), (ctx) => {
  const id = parseInt(ctx.params.id);
  const updates = ctx.req.body;
  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    ctx.res.status = 404;
    return ctx.json({ error: 'User not found' });
  }
  users[userIndex] = { ...users[userIndex], ...updates };
  return ctx.json(users[userIndex]);
});

// Delete user
// NOTE: In production, add CSRF protection middleware: app.use(csrf())
app.delete('/api/users/:id', validate({
  params: z.object({ id: z.string().regex(/^\d+$/) })
}), (ctx) => {
  const id = parseInt(ctx.params.id);
  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    ctx.res.status = 404;
    return ctx.json({ error: 'User not found' });
  }
  const deletedUser = users.splice(userIndex, 1)[0];
  return ctx.json({ message: 'User deleted', user: deletedUser });
});

app.listen(3000).then(() => {
  const LOGO = \`
 ██████╗ ██████╗ ███████╗███╗   ██╗███████╗██████╗ ███████╗███████╗██████╗
██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔══██╗██╔════╝██╔════╝██╔══██╗
██║   ██║██████╔╝█████╗  ██╔██╗ ██║███████╗██████╔╝█████╗  █████╗  ██║  ██║
██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║╚════██║██╔═══╝ ██╔══╝  ██╔══╝  ██║  ██║
╚██████╔╝██║     ███████╗██║ ╚████║███████║██║     ███████╗███████╗██████╔╝
 ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚══════╝╚═╝     ╚══════╝╚══════╝╚═════╝

\`;
  console.log(LOGO);
  console.log(\`🚀 ${projectName} API is running at http://localhost:3000\`);
  console.log(\`📖 Documentation: https://github.com/JonusNattapong/OpenSpeed\`);
  console.log(\`🐛 Issues: https://github.com/JonusNattapong/OpenSpeed/issues\`);
  console.log(\`\\n📋 Available endpoints:\`);
  console.log(\`  GET  /\`);
  console.log(\`  GET  /api/users\`);
  console.log(\`  POST /api/users\`);
  console.log(\`  GET  /api/users/:id\`);
  console.log(\`  PUT  /api/users/:id\`);
  console.log(\`  DELETE /api/users/:id\`);
});
`,
  },
};

async function parseArgs(argv: string[]): Promise<{ target: string; options: CliOptions }> {
  const args = [...argv];
  const options: CliOptions = { ...DEFAULT_OPTIONS };
  const positional: string[] = [];
  let templateProvided = false;

  while (args.length) {
    const arg = args.shift()!;
    switch (arg) {
      case '--template':
      case '-t': {
        const value = args.shift();
        if (!value) throw new Error('Missing value for --template');
        options.template = value as CliOptions['template'];
        templateProvided = true;
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

  let target = positional[0];
  if (!target) {
    target = await input({
      message: 'What is your project named?',
      default: 'openspeed-app',
      validate: (value) => value.length > 0 || 'Project name cannot be empty',
    });
  }

  if (!templateProvided) {
    options.template = (await select({
      message: 'Which template would you like to use?',
      choices: [
        { name: 'Basic - Simple OpenSpeed app', value: 'basic' },
        { name: 'API - REST API with CRUD operations', value: 'api' },
      ],
    })) as CliOptions['template'];
  }

  return { target, options };
}

function printHelp() {
  console.log(`Usage: create-openspeed-app [dir] [options]

Create a new OpenSpeed project.

Arguments:
  [dir]                   The name of the application, as well as the name of the directory to create

Options:
  -t, --template <name>  Template to use (default: basic)
                         Available: basic, api
  -f, --force            Overwrite target directory if not empty
  -h, --help             Show this help message

Examples:
  $ create-openspeed-app my-app
  $ create-openspeed-app my-api --template api
  $ create-openspeed-app --help
`);
}

function sanitizePackageName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/^[^a-z]+/i, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '') || 'openspeed-app'
  );
}

function ensureDirectory(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function isEmpty(dir: string) {
  return !existsSync(dir) || readdirSync(dir).length === 0;
}

function writeProjectFiles(targetDir: string, ctx: TemplateContext, template: string) {
  const templateFiles = TEMPLATES[template];
  for (const [relativePath, templateFn] of Object.entries(templateFiles)) {
    const filePath = path.join(targetDir, relativePath);
    ensureDirectory(path.dirname(filePath));
    writeFileSync(filePath, templateFn(ctx), 'utf8');
  }
}

function logNextSteps(targetDir: string, projectName: string) {
  const relative = path.relative(process.cwd(), targetDir);
  const needsCd = relative !== '' && relative !== '.';

  console.log('\n🎉 Project scaffolded successfully!');
  console.log(`\n🚀 Ready to start developing your ${projectName} app!`);
  if (needsCd) {
    console.log(`\n📋 Next steps:`);
    console.log(`  cd ${relative}`);
    console.log(`  npm install`);
    console.log(`  npm run dev`);
  } else {
    console.log(`\n📋 Next steps:`);
    console.log(`  npm install`);
    console.log(`  npm run dev`);
  }
  console.log(`\n📖 Documentation: https://github.com/JonusNattapong/OpenSpeed`);
  console.log(`🐛 Issues: https://github.com/JonusNattapong/OpenSpeed/issues`);
}

async function main() {
  try {
    const { target, options } = await parseArgs(process.argv.slice(2));
    const targetDir = path.resolve(process.cwd(), target);
    const projectName = path.basename(targetDir);

    if (!TEMPLATES[options.template]) {
      console.error(
        `Error: Unknown template "${options.template}". Available templates: ${Object.keys(TEMPLATES).join(', ')}`
      );
      process.exit(1);
    }

    if (!options.force && !isEmpty(targetDir)) {
      console.error(
        `Error: Directory "${projectName}" already exists and is not empty. Use --force to overwrite.`
      );
      process.exit(1);
    }

    ensureDirectory(targetDir);

    const ctx: TemplateContext = {
      projectName,
      packageName: sanitizePackageName(projectName),
    };

    writeProjectFiles(targetDir, ctx, options.template);
    console.log(LOGO);
    logNextSteps(targetDir, projectName);
  } catch (err: any) {
    console.error(`❌ Error: ${err.message || err}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.message || err}`);
  process.exit(1);
});

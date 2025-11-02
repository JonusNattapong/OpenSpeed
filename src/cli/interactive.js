#!/usr/bin/env node

import { Command } from 'commander';
import { input, select, confirm, checkbox, password } from '@inquirer/prompts';
import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const program = new Command();

program
  .name('openspeed')
  .description('🚀 OpenSpeed Framework - Developer-friendly CLI for rapid development')
  .version('0.7.1');

// Interactive project creation
program
  .command('create')
  .alias('c')
  .description('Create a new OpenSpeed project interactively')
  .argument('[name]', 'Project name')
  .action(async (name) => {
    await createInteractiveProject(name);
  });

// Quick start templates
program
  .command('new')
  .description('Create project from template')
  .argument('<template>', 'Template name (api, web, realtime, fullstack)')
  .argument('[name]', 'Project name')
  .action(async (template, name) => {
    await createFromTemplate(template, name);
  });

// Plugin management
program
  .command('plugin')
  .alias('p')
  .description('Manage OpenSpeed plugins')
  .argument('<action>', 'Action (add, remove, list, search)')
  .argument('[plugin]', 'Plugin name')
  .action(async (action, plugin) => {
    await managePlugins(action, plugin);
  });

// Development server
program
  .command('dev')
  .description('Start development server with hot reload')
  .option('-p, --port <port>', 'Port to run on', '3000')
  .option('-h, --host <host>', 'Host to bind to', 'localhost')
  .action(async (options) => {
    await startDevServer(options);
  });

// Generate code
program
  .command('generate')
  .alias('g')
  .description('Generate code (routes, models, middleware)')
  .argument('<type>', 'Type to generate (route, model, middleware, plugin)')
  .argument('<name>', 'Name of the item')
  .action(async (type, name) => {
    await generateCode(type, name);
  });

// Interactive setup
async function createInteractiveProject(projectName) {
  console.log('🚀 Welcome to OpenSpeed! Let\'s create your project...\n');

  // Get project name
  if (!projectName) {
    projectName = await input({
      message: 'What\'s your project name?',
      default: 'my-openspeed-app',
      validate: (value) => value.length > 0 || 'Project name is required'
    });
  }

  // Choose project type
  const projectType = await select({
    message: 'What type of project would you like to create?',
    choices: [
      { name: '🌐 Web Application (Full-stack with JSX)', value: 'web' },
      { name: '🔌 REST API (Backend only)', value: 'api' },
      { name: '⚡ Real-time App (WebSocket)', value: 'realtime' },
      { name: '📱 Full-stack App (API + Frontend)', value: 'fullstack' },
      { name: '🎯 Microservice', value: 'microservice' },
      { name: '📊 Data API (Database focused)', value: 'data' }
    ]
  });

  // Choose features
  const features = await checkbox({
    message: 'Select features to include:',
    choices: [
      { name: '🔐 Authentication (JWT)', value: 'auth', checked: projectType === 'web' || projectType === 'fullstack' },
      { name: '🗄️ Database (MongoDB/PostgreSQL)', value: 'database', checked: projectType === 'api' || projectType === 'data' },
      { name: '📁 File Upload', value: 'upload', checked: projectType === 'web' || projectType === 'fullstack' },
      { name: '🔒 Security (CORS, CSRF, Rate limiting)', value: 'security', checked: true },
      { name: '📊 Monitoring & Logging', value: 'monitoring', checked: projectType === 'api' || projectType === 'microservice' },
      { name: '📧 Email Service', value: 'email', checked: false },
      { name: '💳 Payment Integration', value: 'payment', checked: false },
      { name: '🧪 Testing Setup', value: 'testing', checked: true },
      { name: '🐳 Docker Support', value: 'docker', checked: false },
      { name: '☸️ Kubernetes Config', value: 'kubernetes', checked: false }
    ]
  });

  // Choose runtime
  const runtime = await select({
    message: 'Which runtime would you like to use?',
    choices: [
      { name: '🚀 Bun (Fastest development)', value: 'bun' },
      { name: '📦 Node.js (Most compatible)', value: 'node' },
      { name: '🦕 Deno (Secure by default)', value: 'deno' }
    ],
    default: 'bun'
  });

  // Package manager
  const packageManager = await select({
    message: 'Which package manager?',
    choices: [
      { name: '📦 npm', value: 'npm' },
      { name: '⚡ pnpm (Recommended)', value: 'pnpm' },
      { name: '🧶 yarn', value: 'yarn' }
    ],
    default: 'pnpm'
  });

  // Git initialization
  const useGit = await confirm({
    message: 'Initialize Git repository?',
    default: true
  });

  // Create project
  console.log(`\n📦 Creating ${projectType} project: ${projectName}`);
  console.log(`Runtime: ${runtime} | Package Manager: ${packageManager}`);
  console.log(`Features: ${features.join(', ')}\n`);

  await createProject({
    name: projectName,
    type: projectType,
    features,
    runtime,
    packageManager,
    useGit
  });

  console.log('\n✅ Project created successfully!');
  console.log('\n🚀 Next steps:');
  console.log(`  cd ${projectName}`);
  console.log(`  ${packageManager} install`);
  console.log(`  ${packageManager} run dev`);
  console.log('\n📚 Documentation: https://openspeed.dev');
}

// Template-based creation
async function createFromTemplate(template, name) {
  const templates = {
    api: { desc: 'REST API with authentication', features: ['auth', 'database', 'security', 'testing'] },
    web: { desc: 'Full-stack web app with JSX', features: ['auth', 'database', 'upload', 'security', 'testing'] },
    realtime: { desc: 'Real-time app with WebSocket', features: ['auth', 'database', 'websocket', 'security', 'testing'] },
    fullstack: { desc: 'Complete full-stack application', features: ['auth', 'database', 'upload', 'websocket', 'security', 'monitoring', 'testing'] }
  };

  if (!templates[template]) {
    console.error(`❌ Unknown template: ${template}`);
    console.log('Available templates:', Object.keys(templates).join(', '));
    process.exit(1);
  }

  const templateConfig = templates[template];
  console.log(`📦 Creating ${template} project (${templateConfig.desc})`);

  await createProject({
    name: name || `my-${template}-app`,
    type: template,
    features: templateConfig.features,
    runtime: 'bun',
    packageManager: 'pnpm',
    useGit: true
  });
}

// Plugin management
async function managePlugins(action, plugin) {
  switch (action) {
    case 'list':
      console.log('📦 Available plugins:');
      console.log('  🔐 auth - JWT authentication');
      console.log('  🗄️ database - Database adapters');
      console.log('  📁 upload - File upload handling');
      console.log('  🔒 security - Security middleware');
      console.log('  📊 monitoring - Metrics & logging');
      console.log('  📧 email - Email service');
      console.log('  💳 stripe - Payment processing');
      console.log('  🧪 testing - Testing utilities');
      break;

    case 'add':
      if (!plugin) {
        console.error('❌ Please specify a plugin to add');
        return;
      }
      console.log(`📦 Adding plugin: ${plugin}`);
      // Implementation would go here
      break;

    case 'search':
      console.log('🔍 Searching plugins...');
      // Implementation would go here
      break;

    default:
      console.error(`❌ Unknown action: ${action}`);
  }
}

// Development server
async function startDevServer(options) {
  console.log(`🚀 Starting development server on ${options.host}:${options.port}`);

  // Check if we're in a project directory
  if (!existsSync('package.json')) {
    console.error('❌ Not in a project directory. Run "openspeed create" first.');
    process.exit(1);
  }

  // Start the development server
  const child = spawn('tsx', ['watch', 'src/index.ts'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: options.port, HOST: options.host }
  });

  child.on('error', (error) => {
    console.error('❌ Failed to start development server:', error.message);
  });
}

// Code generation
async function generateCode(type, name) {
  console.log(`🔧 Generating ${type}: ${name}`);

  switch (type) {
    case 'route':
      await generateRoute(name);
      break;
    case 'model':
      await generateModel(name);
      break;
    case 'middleware':
      await generateMiddleware(name);
      break;
    default:
      console.error(`❌ Unknown type: ${type}`);
  }
}

// Project creation logic
async function createProject(config) {
  const { name, type, features, runtime, packageManager, useGit } = config;

  // Create directory
  if (existsSync(name)) {
    console.error(`❌ Directory "${name}" already exists`);
    process.exit(1);
  }

  mkdirSync(name);
  process.chdir(name);

  // Create package.json
  const pkg = {
    name,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: getDevScript(runtime),
      build: 'tsc',
      start: 'node dist/index.js',
      test: 'vitest run',
      'test:watch': 'vitest'
    },
    dependencies: getDependencies(features, runtime),
    devDependencies: getDevDependencies(features, runtime)
  };

  await fs.writeFile('package.json', JSON.stringify(pkg, null, 2));

  // Create tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ES2022',
      strict: true,
      esModuleInterop: true,
      outDir: 'dist',
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  };

  await fs.writeFile('tsconfig.json', JSON.stringify(tsconfig, null, 2));

  // Create source directory structure
  mkdirSync('src');
  mkdirSync('src/routes');
  mkdirSync('src/middleware');
  mkdirSync('src/plugins');

  // Create main application file
  const mainFile = generateMainFile(type, features);
  await fs.writeFile('src/index.ts', mainFile);

  // Create example routes
  if (features.includes('auth')) {
    await fs.writeFile('src/routes/auth.ts', generateAuthRoutes());
  }

  if (features.includes('database')) {
    await fs.writeFile('src/routes/users.ts', generateUserRoutes());
  }

  // Create README
  const readme = generateReadme(name, type, features, runtime, packageManager);
  await fs.writeFile('README.md', readme);

  // Create .env.example
  const envExample = generateEnvExample(features);
  await fs.writeFile('.env.example', envExample);

  // Create Dockerfile if requested
  if (features.includes('docker')) {
    const dockerfile = generateDockerfile(runtime);
    await fs.writeFile('Dockerfile', dockerfile);
  }

  // Initialize git
  if (useGit) {
    try {
      execSync('git init', { stdio: 'ignore' });
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });
    } catch (error) {
      // Git not available, skip
    }
  }
}

// Helper functions
function getDevScript(runtime) {
  switch (runtime) {
    case 'bun': return 'bun --hot src/index.ts';
    case 'deno': return 'deno run --watch --allow-net --allow-env src/index.ts';
    default: return 'tsx watch src/index.ts';
  }
}

function getDependencies(features, runtime) {
  const deps = {
    'openspeed': '^0.7.1'
  };

  if (features.includes('auth')) deps['@openspeed/auth'] = '^0.1.0';
  if (features.includes('database')) {
    deps['mongodb'] = '^6.0.0';
    deps['pg'] = '^8.11.0';
  }
  if (features.includes('upload')) deps['multer'] = '^1.4.5';
  if (features.includes('email')) deps['nodemailer'] = '^6.9.0';
  if (features.includes('payment')) deps['stripe'] = '^13.0.0';

  return deps;
}

function getDevDependencies(features, runtime) {
  const deps = {
    'typescript': '^5.0.0',
    'tsx': '^4.0.0',
    'vitest': '^1.0.0'
  };

  if (runtime === 'bun') deps['bun-types'] = '^1.0.0';
  if (runtime === 'deno') deps['deno-types'] = '^1.0.0';

  return deps;
}

function generateMainFile(type, features) {
  let imports = `import { createApp } from 'openspeed';\n`;
  let middleware = '';
  let routes = '';

  if (features.includes('security')) {
    imports += `import { security, securityPresets } from 'openspeed/plugins/security';\n`;
    middleware += `app.use(security(securityPresets.production));\n`;
  }

  if (features.includes('auth')) {
    imports += `import { auth } from '@openspeed/auth';\n`;
    middleware += `app.use(auth({ secret: process.env.JWT_SECRET! }));\n`;
  }

  if (features.includes('database')) {
    imports += `import { database } from 'openspeed/plugins/database';\n`;
    middleware += `app.use(database({\n  type: 'mongodb',\n  connection: process.env.DATABASE_URL!\n}));\n`;
  }

  if (features.includes('cors')) {
    imports += `import { cors } from 'openspeed/plugins/cors';\n`;
    middleware += `app.use(cors());\n`;
  }

  // Basic routes
  routes += `
// Health check
app.get('/health', (ctx) => {
  return ctx.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.get('/api/v1', (ctx) => {
  return ctx.json({
    message: 'Welcome to ${type} API',
    version: '1.0.0',
    features: ${JSON.stringify(features)}
  });
});
`;

  if (type === 'web') {
    routes += `
// Web routes
app.get('/', (ctx) => {
  return ctx.html(\`
    <!DOCTYPE html>
    <html>
      <head>
        <title>OpenSpeed App</title>
        <meta charset="utf-8">
      </head>
      <body>
        <h1>Welcome to OpenSpeed!</h1>
        <p>Your ${type} application is running.</p>
      </body>
    </html>
  \`);
});
`;
  }

  return `${imports}
const app = createApp();

${middleware}

${routes}

// Start server
const port = process.env.PORT || 3000;
console.log(\`🚀 Server running on http://localhost:\${port}\`);

export default {
  port,
  fetch: app.fetch
};
`;
}

function generateAuthRoutes() {
  return `import { createApp } from 'openspeed';

const authRoutes = createApp();

// Login route
authRoutes.post('/login', async (ctx) => {
  const { email, password } = await ctx.req.json();

  // TODO: Implement authentication logic
  const token = 'fake-jwt-token';

  return ctx.json({
    success: true,
    token,
    user: { email }
  });
});

// Register route
authRoutes.post('/register', async (ctx) => {
  const { email, password, name } = await ctx.req.json();

  // TODO: Implement user registration
  return ctx.json({
    success: true,
    message: 'User registered successfully'
  });
});

export default authRoutes;
`;
}

function generateUserRoutes() {
  return `import { createApp } from 'openspeed';

const userRoutes = createApp();

// Get all users
userRoutes.get('/users', async (ctx) => {
  // TODO: Get users from database
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com' }
  ];

  return ctx.json(users);
});

// Get user by ID
userRoutes.get('/users/:id', async (ctx) => {
  const userId = ctx.params.id;

  // TODO: Get user from database
  const user = {
    id: userId,
    name: \`User \${userId}\`,
    email: \`user\${userId}@example.com\`
  };

  return ctx.json(user);
});

export default userRoutes;
`;
}

function generateReadme(name, type, features, runtime, packageManager) {
  return `# ${name}

A ${type} application built with OpenSpeed.

## Features

${features.map(f => `- ${f}`).join('\n')}

## Getting Started

1. Install dependencies:
   \`\`\`bash
   ${packageManager} install
   \`\`\`

2. Start development server:
   \`\`\`bash
   ${packageManager} run dev
   \`\`\`

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Runtime

This project uses ${runtime} as the runtime environment.

## Project Structure

\`\`\`
src/
├── index.ts          # Main application file
├── routes/           # Route handlers
├── middleware/       # Custom middleware
└── plugins/          # Custom plugins
\`\`\`

## Available Scripts

- \`dev\` - Start development server
- \`build\` - Build for production
- \`start\` - Start production server
- \`test\` - Run tests

## Environment Variables

Copy \`.env.example\` to \`.env\` and fill in your values.

## Documentation

- [OpenSpeed Documentation](https://openspeed.dev)
- [API Reference](https://openspeed.dev/api)
`;
}

function generateEnvExample(features) {
  let env = `# Environment Configuration
PORT=3000
NODE_ENV=development

`;

  if (features.includes('auth')) {
    env += `# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

`;
  }

  if (features.includes('database')) {
    env += `# Database
DATABASE_URL=mongodb://localhost:27017/${name}
# DATABASE_URL=postgresql://user:password@localhost:5432/${name}

`;
  }

  if (features.includes('email')) {
    env += `# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

`;
  }

  if (features.includes('payment')) {
    env += `# Payment (Stripe)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

`;
  }

  return env;
}

function generateDockerfile(runtime) {
  if (runtime === 'bun') {
    return `FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

COPY . .

EXPOSE 3000

CMD ["bun", "src/index.ts"]
`;
  }

  if (runtime === 'deno') {
    return `FROM denoland/deno:latest

WORKDIR /app

COPY . .

EXPOSE 3000

CMD ["deno", "run", "--allow-net", "--allow-env", "src/index.ts"]
`;
  }

  return `FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "src/index.ts"]
`;
}

// Placeholder functions for code generation
async function generateRoute(name) {
  const routeContent = `import { createApp } from 'openspeed';

const ${name}Routes = createApp();

// TODO: Implement ${name} routes
${name}Routes.get('/', (ctx) => {
  return ctx.json({ message: '${name} endpoint' });
});

export default ${name}Routes;
`;

  const filename = `src/routes/${name}.ts`;
  await fs.writeFile(filename, routeContent);
  console.log(`✅ Created route: ${filename}`);
}

async function generateModel(name) {
  const modelContent = `// ${name} model
export interface ${name} {
  id: string;
  // TODO: Add ${name} properties
}

// TODO: Implement ${name} model methods
export class ${name}Model {
  static async findAll() {
    // TODO: Implement database query
    return [];
  }

  static async findById(id: string) {
    // TODO: Implement database query
    return null;
  }

  static async create(data: Partial<${name}>) {
    // TODO: Implement database insert
    return null;
  }
}
`;

  const filename = `src/models/${name}.ts`;
  await fs.mkdir('src/models', { recursive: true });
  await fs.writeFile(filename, modelContent);
  console.log(`✅ Created model: ${filename}`);
}

async function generateMiddleware(name) {
  const middlewareContent = `import type { Context } from 'openspeed';

// ${name} middleware
export function ${name}Middleware(options: any = {}) {
  return async (ctx: Context, next: () => Promise<any>) => {
    // TODO: Implement ${name} middleware logic
    console.log('${name} middleware executed');

    await next();
  };
}
`;

  const filename = `src/middleware/${name}.ts`;
  await fs.writeFile(filename, middlewareContent);
  console.log(`✅ Created middleware: ${filename}`);
}

// Run CLI
program.parse();
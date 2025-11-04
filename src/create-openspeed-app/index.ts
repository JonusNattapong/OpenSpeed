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
  "description": "A modern web application built with OpenSpeed",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --project tsconfig.json",
    "start": "node dist/index.js",
    "lint": "eslint src/**/*.{ts,js}",
    "lint:fix": "eslint src/**/*.{ts,js} --fix",
    "format": "prettier --write src/**/*.{ts,js}",
    "format:check": "prettier --check src/**/*.{ts,js}",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["openspeed", "web", "framework", "typescript"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "openspeed": "latest"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
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
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`,
    '.gitignore': () =>
      `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
`,
    '.env.example': () =>
      `# Environment Variables
# Copy this file to .env and fill in your values

# Server Configuration
PORT=3000
NODE_ENV=development

# Add your environment variables here
`,
    '.prettierrc.json': () =>
      `{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
`,
    'eslint.config.js': () =>
      `import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  eslint.configs.recommended,
  {
    files: ['src/**/*.{ts,js}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
];
`,
    'README.md': ({ projectName }) =>
      `# ${projectName}

A modern web application built with [OpenSpeed](https://github.com/JonusNattapong/OpenSpeed) - High-performance web framework with JSX, SSG, RPC, streaming, and type safety.

## 🚀 Features

- ⚡ **High Performance**: Built on OpenSpeed framework
- 🔒 **Type Safe**: Full TypeScript support
- 🛠️ **Developer Friendly**: Hot reload, linting, formatting
- 📦 **Production Ready**: Optimized build and deployment

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm or yarn

## 🏁 Getting Started

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Start development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

3. **Open your browser:**
   Visit [http://localhost:3000](http://localhost:3000)

## 📜 Available Scripts

- \`npm run dev\` - Start development server with hot reload
- \`npm run build\` - Build for production
- \`npm run start\` - Start production server
- \`npm run lint\` - Run ESLint
- \`npm run lint:fix\` - Fix ESLint issues
- \`npm run format\` - Format code with Prettier
- \`npm run typecheck\` - Run TypeScript type checking

## 🏗️ Project Structure

\`\`\`
${projectName}/
├── src/
│   └── index.ts          # Main application entry point
├── dist/                 # Compiled output (generated)
├── package.json
├── tsconfig.json
├── eslint.config.js
├── .prettierrc.json
├── .env.example
└── README.md
\`\`\`

## 🔧 Configuration

1. Copy \`.env.example\` to \`.env\` and configure your environment variables
2. Adjust TypeScript settings in \`tsconfig.json\` if needed
3. Customize ESLint rules in \`eslint.config.js\`

## 🚀 Deployment

1. Build the application:
   \`\`\`bash
   npm run build
   \`\`\`

2. Start the production server:
   \`\`\`bash
   npm run start
   \`\`\`

## 📚 Learn More

- [OpenSpeed Documentation](https://github.com/JonusNattapong/OpenSpeed)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues

If you find any bugs or have feature requests, please create an issue on [GitHub](https://github.com/JonusNattapong/OpenSpeed/issues).
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

Welcome to ${projectName}
\`;

const app = createApp();

// Middleware
app.use(logger());
app.use(json());
app.use(errorHandler());

// Routes
app.get('/', (ctx) => {
  return ctx.json({
    message: 'Welcome to ${projectName}!',
    framework: 'OpenSpeed',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (ctx) => {
  return ctx.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Error handling for unknown routes
app.use((ctx) => {
  ctx.res.status = 404;
  return ctx.json({ error: 'Not Found', path: ctx.req.url });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT).then(() => {
  console.log(LOGO);
  console.log(\`🚀 ${projectName} is running at http://localhost:\${PORT}\`);
  console.log(\`📖 Documentation: https://github.com/JonusNattapong/OpenSpeed\`);
  console.log(\`🐛 Issues: https://github.com/JonusNattapong/OpenSpeed/issues\`);
  console.log(\`\\n📋 Available routes:\`);
  console.log(\`  GET  /\`);
  console.log(\`  GET  /health\`);
});
`,
    LICENSE: () =>
      `MIT License

Copyright (c) ${new Date().getFullYear()} ${process.env.USER || 'Your Name'}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`,
  },
  api: {
    'package.json': ({ packageName }) =>
      `{
  "name": "${packageName}",
  "version": "0.1.0",
  "description": "A REST API built with OpenSpeed - High-performance web framework",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --project tsconfig.json",
    "start": "node dist/index.js",
    "lint": "eslint src/**/*.{ts,js}",
    "lint:fix": "eslint src/**/*.{ts,js} --fix",
    "format": "prettier --write src/**/*.{ts,js}",
    "format:check": "prettier --check src/**/*.{ts,js}",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["openspeed", "api", "rest", "typescript", "zod"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "openspeed": "latest",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
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
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`,
    '.gitignore': () =>
      `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
`,
    '.env.example': () =>
      `# Environment Variables
# Copy this file to .env and fill in your values

# Server Configuration
PORT=3000
NODE_ENV=development

# Database (if using)
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Add your environment variables here
`,
    '.prettierrc.json': () =>
      `{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
`,
    'eslint.config.js': () =>
      `import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  eslint.configs.recommended,
  {
    files: ['src/**/*.{ts,js}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
];
`,
    'README.md': ({ projectName }) =>
      `# ${projectName} API

A REST API built with [OpenSpeed](https://github.com/JonusNattapong/OpenSpeed) - High-performance web framework with built-in validation, type safety, and enterprise features.

## 🚀 Features

- ⚡ **High Performance**: Built on OpenSpeed framework
- 🔒 **Type Safe**: Full TypeScript with Zod validation
- 📋 **RESTful API**: Complete CRUD operations
- 🛡️ **Security**: CORS, input validation, error handling
- 🛠️ **Developer Friendly**: Hot reload, linting, formatting
- 📦 **Production Ready**: Optimized build and deployment

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm or yarn

## 🏁 Getting Started

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Start development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

3. **Test the API:**
   Visit [http://localhost:3000](http://localhost:3000)

## 📜 Available Scripts

- \`npm run dev\` - Start development server with hot reload
- \`npm run build\` - Build for production
- \`npm run start\` - Start production server
- \`npm run lint\` - Run ESLint
- \`npm run lint:fix\` - Fix ESLint issues
- \`npm run format\` - Format code with Prettier
- \`npm run typecheck\` - Run TypeScript type checking

## 📋 API Endpoints

### Health & Info
- \`GET /\` - API information and health check
- \`GET /health\` - Health status

### Users API
- \`GET /api/users\` - Get all users
- \`POST /api/users\` - Create a new user
- \`GET /api/users/:id\` - Get user by ID
- \`PUT /api/users/:id\` - Update user by ID
- \`DELETE /api/users/:id\` - Delete user by ID

### Request/Response Examples

**Create User:**
\`\`\`bash
curl -X POST http://localhost:3000/api/users \\
  -H "Content-Type: application/json" \\
  -d '{"name": "John Doe", "email": "john@example.com"}'
\`\`\`

**Get Users:**
\`\`\`bash
curl http://localhost:3000/api/users
\`\`\`

## 🏗️ Project Structure

\`\`\`
${projectName}/
├── src/
│   ├── index.ts          # Main API entry point
│   └── types.ts          # Type definitions (if needed)
├── dist/                 # Compiled output (generated)
├── package.json
├── tsconfig.json
├── eslint.config.js
├── .prettierrc.json
├── .env.example
└── README.md
\`\`\`

## 🔧 Configuration

1. Copy \`.env.example\` to \`.env\` and configure your environment variables
2. Adjust TypeScript settings in \`tsconfig.json\` if needed
3. Customize ESLint rules in \`eslint.config.js\`
4. Modify API routes and validation schemas in \`src/index.ts\`

## 🚀 Deployment

1. Build the application:
   \`\`\`bash
   npm run build
   \`\`\`

2. Start the production server:
   \`\`\`bash
   npm run start
   \`\`\`

## 🔒 Security Notes

- This template includes basic CORS setup
- Input validation using Zod schemas
- In production, consider adding:
  - Authentication middleware
  - Rate limiting
  - CSRF protection
  - Database integration
  - Logging and monitoring

## 📚 Learn More

- [OpenSpeed Documentation](https://github.com/JonusNattapong/OpenSpeed)
- [Zod Validation](https://zod.dev/)
- [REST API Best Practices](https://restfulapi.net/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues

If you find any bugs or have feature requests, please create an issue on [GitHub](https://github.com/JonusNattapong/OpenSpeed/issues).
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
  console.log(`\n🚀 Ready to start developing your ${projectName} project!`);
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
  console.log(`\n🛠️  Available commands:`);
  console.log(`  npm run build    - Build for production`);
  console.log(`  npm run lint     - Run linter`);
  console.log(`  npm run format   - Format code`);
  console.log(`\n📖 Documentation: https://github.com/JonusNattapong/OpenSpeed`);
  console.log(`🐛 Issues: https://github.com/JonusNattapong/OpenSpeed/issues`);
  console.log(`💬 Community: https://github.com/JonusNattapong/OpenSpeed/discussions`);
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

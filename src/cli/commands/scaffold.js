import { Command } from 'commander';
import { input, select, confirm, checkbox, password, editor } from '@inquirer/prompts';
import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

class AIScaffoldEngine {
  constructor() {
    this.templates = new Map();
    this.aiContext = new Map();
    this.generationHistory = [];
  }

  async analyzeRequirements(requirements) {
    console.log('🤖 AI analyzing project requirements...');

    // Simulate AI analysis (in real implementation, this would call an AI service)
    const analysis = {
      framework: this.detectFramework(requirements),
      features: this.extractFeatures(requirements),
      complexity: this.assessComplexity(requirements),
      architecture: this.suggestArchitecture(requirements),
      dependencies: this.recommendDependencies(requirements),
      patterns: this.identifyPatterns(requirements)
    };

    this.aiContext.set('analysis', analysis);
    return analysis;
  }

  detectFramework(requirements) {
    const text = requirements.toLowerCase();
    if (text.includes('real-time') || text.includes('websocket')) return 'realtime';
    if (text.includes('api') || text.includes('rest')) return 'api';
    if (text.includes('full-stack') || text.includes('web app')) return 'fullstack';
    if (text.includes('microservice')) return 'microservice';
    return 'web';
  }

  extractFeatures(requirements) {
    const features = [];
    const text = requirements.toLowerCase();

    if (text.includes('authentication') || text.includes('auth')) features.push('auth');
    if (text.includes('database') || text.includes('db')) features.push('database');
    if (text.includes('file upload') || text.includes('upload')) features.push('upload');
    if (text.includes('email') || text.includes('mail')) features.push('email');
    if (text.includes('payment') || text.includes('stripe')) features.push('payment');
    if (text.includes('websocket') || text.includes('real-time')) features.push('websocket');
    if (text.includes('graphql')) features.push('graphql');
    if (text.includes('openapi') || text.includes('swagger')) features.push('openapi');
    if (text.includes('cors')) features.push('cors');
    if (text.includes('rate limit')) features.push('rate-limit');
    if (text.includes('compression')) features.push('compression');
    if (text.includes('logging')) features.push('logging');

    return features;
  }

  assessComplexity(requirements) {
    const text = requirements.toLowerCase();
    let score = 1;

    if (text.includes('enterprise') || text.includes('production')) score += 2;
    if (text.includes('microservice') || text.includes('distributed')) score += 1;
    if (text.includes('real-time') || text.includes('websocket')) score += 1;
    if (text.includes('authentication') || text.includes('security')) score += 1;
    if (text.includes('database') || text.includes('data')) score += 1;

    return Math.min(score, 5); // Max complexity 5
  }

  suggestArchitecture(requirements) {
    const complexity = this.assessComplexity(requirements);
    const features = this.extractFeatures(requirements);

    if (complexity >= 4) return 'enterprise';
    if (features.includes('microservice')) return 'microservices';
    if (features.includes('real-time')) return 'event-driven';
    return 'monolithic';
  }

  recommendDependencies(requirements) {
    const features = this.extractFeatures(requirements);
    const deps = {
      dependencies: [],
      devDependencies: ['typescript', 'tsx', 'vitest', '@types/node']
    };

    // Database dependencies
    if (features.includes('database')) {
      deps.dependencies.push('prisma', '@prisma/client', 'mysql2', 'pg', 'mongodb');
    }

    // Authentication
    if (features.includes('auth')) {
      deps.dependencies.push('jsonwebtoken', 'bcryptjs', '@types/jsonwebtoken', '@types/bcryptjs');
    }

    // File uploads
    if (features.includes('upload')) {
      deps.dependencies.push('multer', '@types/multer');
    }

    // Email
    if (features.includes('email')) {
      deps.dependencies.push('nodemailer', '@types/nodemailer');
    }

    // Payments
    if (features.includes('payment')) {
      deps.dependencies.push('stripe');
    }

    // WebSocket
    if (features.includes('websocket')) {
      deps.dependencies.push('ws', '@types/ws');
    }

    // GraphQL
    if (features.includes('graphql')) {
      deps.dependencies.push('graphql', '@graphql-tools/schema', 'graphql-helix');
    }

    return deps;
  }

  identifyPatterns(requirements) {
    const patterns = [];
    const text = requirements.toLowerCase();

    if (text.includes('crud') || text.includes('rest')) patterns.push('repository', 'service');
    if (text.includes('microservice')) patterns.push('api-gateway', 'service-discovery');
    if (text.includes('real-time')) patterns.push('observer', 'pub-sub');
    if (text.includes('authentication')) patterns.push('middleware', 'guard');

    return patterns;
  }

  async generateProjectStructure(analysis, projectName, targetDir) {
    console.log('🏗️ AI generating project structure...');

    const structure = {
      directories: [
        'src',
        'src/routes',
        'src/middleware',
        'src/services',
        'src/models',
        'src/utils',
        'src/config',
        'tests',
        'tests/unit',
        'tests/integration',
        'docs',
        'scripts'
      ],
      files: []
    };

    // Add feature-specific directories
    if (analysis.features.includes('auth')) {
      structure.directories.push('src/auth', 'src/auth/strategies');
    }

    if (analysis.features.includes('database')) {
      structure.directories.push('src/database', 'prisma');
    }

    if (analysis.features.includes('websocket')) {
      structure.directories.push('src/websocket', 'src/events');
    }

    // Generate core files
    structure.files = await this.generateCoreFiles(analysis, projectName);

    return structure;
  }

  async generateCoreFiles(analysis, projectName) {
    const files = [];

    // Package.json
    files.push({
      path: 'package.json',
      content: this.generatePackageJson(analysis, projectName)
    });

    // Main application file
    files.push({
      path: 'src/index.ts',
      content: this.generateMainApp(analysis, projectName)
    });

    // Environment configuration
    files.push({
      path: 'src/config/index.ts',
      content: this.generateConfig(analysis)
    });

    // Generate feature-specific files
    for (const feature of analysis.features) {
      const featureFiles = await this.generateFeatureFiles(feature, analysis);
      files.push(...featureFiles);
    }

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme(analysis, projectName)
    });

    return files;
  }

  generatePackageJson(analysis, projectName) {
    const deps = this.recommendDependencies(analysis);

    return JSON.stringify({
      name: projectName,
      version: '0.1.0',
      description: `AI-generated ${analysis.framework} application`,
      main: 'dist/src/index.js',
      type: 'module',
      scripts: {
        build: 'tsc -p tsconfig.build.json',
        start: 'node dist/src/index.js',
        dev: 'tsx watch src/index.ts',
        test: 'vitest run',
        'test:watch': 'vitest',
        lint: 'eslint src/**/*.{ts,js}',
        'lint:fix': 'eslint --fix src/**/*.{ts,js}'
      },
      dependencies: deps.dependencies.reduce((acc, dep) => {
        acc[dep] = 'latest';
        return acc;
      }, {}),
      devDependencies: deps.devDependencies.reduce((acc, dep) => {
        acc[dep] = 'latest';
        return acc;
      }, {})
    }, null, 2);
  }

  generateMainApp(analysis, projectName) {
    let code = `import { createApp } from 'openspeed';
import { config } from './config/index.js';

// Import routes
import indexRoutes from './routes/index.js';
`;

    // Add feature imports
    if (analysis.features.includes('auth')) {
      code += `import { auth } from 'openspeed/plugins';\n`;
    }

    if (analysis.features.includes('cors')) {
      code += `import { cors } from 'openspeed/plugins';\n`;
    }

    if (analysis.features.includes('rate-limit')) {
      code += `import { rateLimit } from 'openspeed/plugins';\n`;
    }

    code += `
const app = createApp();

// Middleware
app.use(cors());
`;

    if (analysis.features.includes('rate-limit')) {
      code += `app.use(rateLimit({ windowMs: 900000, max: 100 }));\n`;
    }

    if (analysis.features.includes('auth')) {
      code += `
// Authentication setup
app.use(auth({
  jwt: { secret: config.jwtSecret }
}));
`;
    }

    code += `
// Routes
app.use('/', indexRoutes);

// Health check
app.get('/health', (ctx) => {
  ctx.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

console.log(\`🚀 ${projectName} server starting...\`);

app.listen(config.port);
`;

    return code;
  }

  generateConfig(analysis) {
    let config = `export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
`;

    if (analysis.features.includes('auth')) {
      config += `  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',\n`;
    }

    if (analysis.features.includes('database')) {
      config += `  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/${analysis.framework}',
  },\n`;
    }

    if (analysis.features.includes('email')) {
      config += `  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  },\n`;
    }

    config += `};
`;

    return config;
  }

  async generateFeatureFiles(feature, analysis) {
    const files = [];

    switch (feature) {
      case 'auth':
        files.push({
          path: 'src/auth/index.ts',
          content: this.generateAuthModule()
        });
        break;

      case 'database':
        files.push({
          path: 'prisma/schema.prisma',
          content: this.generatePrismaSchema(analysis)
        });
        break;

      case 'websocket':
        files.push({
          path: 'src/websocket/index.ts',
          content: this.generateWebSocketModule()
        });
        break;
    }

    return files;
  }

  generateAuthModule() {
    return `import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(payload: any): string {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, config.jwtSecret);
    } catch (error) {
      return null;
    }
  }
}

export const authService = new AuthService();
`;
  }

  generatePrismaSchema(analysis) {
    return `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
`;
  }

  generateWebSocketModule() {
    return `import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

export class WebSocketManager extends EventEmitter {
  private connections = new Map<string, WebSocket>();

  handleConnection(ws: WebSocket, clientId: string) {
    this.connections.set(clientId, ws);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.emit('message', { clientId, message });
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      this.connections.delete(clientId);
      this.emit('disconnect', clientId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.connections.delete(clientId);
    });
  }

  broadcast(message: any, excludeClientId?: string) {
    const data = JSON.stringify(message);

    for (const [clientId, ws] of this.connections) {
      if (clientId !== excludeClientId && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  sendTo(clientId: string, message: any) {
    const ws = this.connections.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}

export const wsManager = new WebSocketManager();
`;
  }

  generateReadme(analysis, projectName) {
    return `# ${projectName}

AI-generated ${analysis.framework} application using OpenSpeed Framework.

## Features

${analysis.features.map(feature => `- ✅ ${feature}`).join('\n')}

## Architecture

- **Framework**: ${analysis.architecture}
- **Complexity**: ${'⭐'.repeat(analysis.complexity)}${'☆'.repeat(5 - analysis.complexity)}
- **Patterns**: ${analysis.patterns.join(', ')}

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Set up environment variables:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

3. Run database migrations (if using database):
   \`\`\`bash
   npx prisma migrate dev
   \`\`\`

4. Start development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## API Endpoints

- \`GET /health\` - Health check
- \`GET /\` - Welcome message

## Development

- \`npm run build\` - Build for production
- \`npm run test\` - Run tests
- \`npm run lint\` - Lint code

## Generated by OpenSpeed AI Scaffold Engine

This project was intelligently generated based on your requirements using advanced AI analysis and best practices.
`;
  }
}

export function scaffoldCommand() {
  const cmd = new Command('scaffold')
    .description('🤖 AI-powered project scaffolding with intelligent analysis')
    .argument('[name]', 'Project name')
    .option('-t, --template <template>', 'Project template')
    .option('-f, --features <features>', 'Comma-separated features')
    .option('-i, --interactive', 'Interactive mode')
    .option('-d, --directory <dir>', 'Target directory')
    .action(async (name, options) => {
      try {
        const aiEngine = new AIScaffoldEngine();

        let projectName = name;
        let requirements = '';
        let targetDir = options.directory || process.cwd();

        if (options.interactive || !name) {
          console.log('🚀 OpenSpeed AI Scaffold Engine');
          console.log('================================');

          projectName = projectName || await input({
            message: 'What is your project name?',
            default: 'my-openspeed-app'
          });

          const description = await editor({
            message: 'Describe your project requirements (be as detailed as possible):',
            default: 'I need a web API with authentication, database integration, and real-time features.'
          });

          requirements = description;

          const confirmAnalysis = await confirm({
            message: 'Would you like AI to analyze and suggest improvements?',
            default: true
          });

          if (confirmAnalysis) {
            const analysis = await aiEngine.analyzeRequirements(requirements);
            console.log('\n🤖 AI Analysis Results:');
            console.log(`Framework: ${analysis.framework}`);
            console.log(`Architecture: ${analysis.architecture}`);
            console.log(`Complexity: ${'⭐'.repeat(analysis.complexity)}`);
            console.log(`Features: ${analysis.features.join(', ')}`);

            const acceptSuggestions = await confirm({
              message: 'Accept AI suggestions?',
              default: true
            });

            if (!acceptSuggestions) {
              // Allow manual feature selection
              const selectedFeatures = await checkbox({
                message: 'Select features to include:',
                choices: [
                  { name: 'Authentication', value: 'auth' },
                  { name: 'Database Integration', value: 'database' },
                  { name: 'File Upload', value: 'upload' },
                  { name: 'Email Service', value: 'email' },
                  { name: 'Payment Processing', value: 'payment' },
                  { name: 'WebSocket Support', value: 'websocket' },
                  { name: 'GraphQL API', value: 'graphql' },
                  { name: 'OpenAPI Documentation', value: 'openapi' },
                  { name: 'CORS Support', value: 'cors' },
                  { name: 'Rate Limiting', value: 'rate-limit' }
                ]
              });

              analysis.features = selectedFeatures;
            }
          }
        } else {
          requirements = options.features || 'basic web application';
        }

        // Analyze requirements
        const analysis = await aiEngine.analyzeRequirements(requirements);

        // Generate project structure
        const structure = await aiEngine.generateProjectStructure(analysis, projectName, targetDir);

        // Create target directory
        const projectDir = join(targetDir, projectName);
        if (!existsSync(projectDir)) {
          mkdirSync(projectDir, { recursive: true });
        }

        // Create directories
        for (const dir of structure.directories) {
          const dirPath = join(projectDir, dir);
          if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true });
          }
        }

        // Create files
        for (const file of structure.files) {
          const filePath = join(projectDir, file.path);
          const dirPath = dirname(filePath);

          if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true });
          }

          await fs.writeFile(filePath, file.content, 'utf-8');
          console.log(`📄 Created ${file.path}`);
        }

        console.log(`\n🎉 Project "${projectName}" scaffolded successfully!`);
        console.log(`📁 Location: ${projectDir}`);
        console.log(`\n🚀 Next steps:`);
        console.log(`  cd ${projectName}`);
        console.log(`  npm install`);
        console.log(`  npm run dev`);

      } catch (error) {
        console.error('❌ Scaffold failed:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}
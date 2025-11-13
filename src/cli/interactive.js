#!/usr/bin/env node

import { Command } from 'commander';
import { input, select, confirm, checkbox } from '@inquirer/prompts';
import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { AICodeGenerator } from './commands/generate.js';

const __filename = fileURLToPath(import.meta.url);

const program = new Command();

// ASCII Logo for OpenSpeed
function displayLogo() {
  const logo = `
    ██████╗ ██████╗ ███████╗███╗   ██╗███████╗██████╗ ███████╗███████╗██████╗
   ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔══██╗██╔════╝██╔════╝██╔══██╗
   ██║   ██║██████╔╝█████╗  ██╔██╗ ██║███████╗██████╔╝█████╗  █████╗  ██║  ██║
   ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║╚════██║██╔═══╝ ██╔══╝  ██╔══╝  ██║  ██║
   ╚██████╔╝██║     ███████╗██║ ╚████║███████║██║     ███████╗███████╗██████╔╝
    ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚══════╝╚═╝     ╚══════╝╚══════╝╚═════╝
`;
  console.log(chalk.cyan.bold(logo));
  console.log(
    chalk.yellow(
      '🚀 High-performance web framework with JSX, SSG, RPC, streaming, and type safety\n'
    )
  );
}

// Enhanced welcome message
function displayWelcome() {
  const welcome = boxen(
    chalk.blue.bold('Welcome to OpenSpeed') +
      '\n\n' +
      chalk.white("Let's create something amazing together.\n") +
      chalk.gray('Choose from interactive prompts or use templates for quick starts.'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
      backgroundColor: '#001122',
    }
  );
  console.log(welcome);
}

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
    displayLogo();
    displayWelcome();
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

// Generate client
program
  .command('client')
  .description('Generate type-safe client from running OpenSpeed server')
  .argument('<filename>', 'Output filename (client.ts, client.php, client.cpp)')
  .option('-u, --url <url>', 'Server URL', 'http://localhost:3000')
  .action(async (filename, options) => {
    await generateClient(filename, options);
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

// Shell completion
program
  .command('completion')
  .description('Generate shell completion script')
  .argument('<shell>', 'Shell type (bash, zsh, fish)')
  .action(async (shell) => {
    await generateCompletion(shell);
  });

// Interactive setup
// Quick AI code generation
program
  .command('ai')
  .description('🚀 Quick AI-powered code generation with interactive prompts')
  .option('-p, --provider <provider>', 'AI provider (openai, deepseek, openrouter)', 'openai')
  .option('--no-cache', 'Disable caching')
  .action(async (options) => {
    await quickAIGenerate(options);
  });

// Performance stats
program
  .command('stats')
  .description('📊 Show AI code generation performance statistics')
  .action(async () => {
    await showPerformanceStats();
  });

// Quick setup
program
  .command('quick')
  .description('⚡ Quick project setup with sensible defaults')
  .argument('[name]', 'Project name')
  .option('-t, --type <type>', 'Project type (api, web, fullstack)', 'api')
  .option('-r, --runtime <runtime>', 'Runtime (bun, node)', 'bun')
  .option('-p, --package-manager <pm>', 'Package manager (pnpm, npm)', 'pnpm')
  .action(async (name, options) => {
    await quickSetup(name, options);
  });

// Interactive setup
async function createInteractiveProject(projectName) {
  try {
    // Welcome message is now handled in command action

    // Get project name
    if (!projectName) {
      projectName = await input({
        message: "What's your project name?",
        default: 'my-openspeed-app',
        validate: (value) => {
          if (!value || value.length === 0) return 'Project name is required';
          if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) {
            return 'Project name must start with a letter and contain only letters, numbers, hyphens, and underscores';
          }
          if (existsSync(value)) {
            return `Directory "${value}" already exists. Please choose a different name.`;
          }
          return true;
        },
        transformer: (value) => value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      });
    }

    // Validate project name if provided
    if (projectName) {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(projectName)) {
        throw new Error('Project name must start with a letter and contain only letters, numbers, hyphens, and underscores');
      }
      if (existsSync(projectName)) {
        throw new Error(`Directory "${projectName}" already exists`);
      }
    }
  } catch (error) {
    console.error(chalk.red('❌ Project setup failed:'), error.message);
    process.exit(1);
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
      { name: '📊 Data API (Database focused)', value: 'data' },
    ],
  });

  // Choose features
  const features = await checkbox({
    message: 'Select features to include:',
    choices: [
      {
        name: '🔐 Authentication (JWT)',
        value: 'auth',
        checked: projectType === 'web' || projectType === 'fullstack',
      },
      {
        name: '🗄️ Database (MongoDB/PostgreSQL)',
        value: 'database',
        checked: projectType === 'api' || projectType === 'data',
      },
      {
        name: '📁 File Upload',
        value: 'upload',
        checked: projectType === 'web' || projectType === 'fullstack',
      },
      { name: '🔒 Security (CORS, CSRF, Rate limiting)', value: 'security', checked: true },
      {
        name: '📊 Monitoring & Logging',
        value: 'monitoring',
        checked: projectType === 'api' || projectType === 'microservice',
      },
      { name: '📧 Email Service', value: 'email', checked: false },
      { name: '💳 Payment Integration', value: 'payment', checked: false },
      { name: '🧪 Testing Setup', value: 'testing', checked: true },
      { name: '🐳 Docker Support', value: 'docker', checked: false },
      { name: '☸️ Kubernetes Config', value: 'kubernetes', checked: false },
    ],
  });

  // Choose runtime
  const runtime = await select({
    message: 'Which runtime would you like to use?',
    choices: [
      { name: '🚀 Bun (Fastest development)', value: 'bun' },
      { name: '📦 Node.js (Most compatible)', value: 'node' },
      { name: '🦕 Deno (Secure by default)', value: 'deno' },
    ],
    default: 'bun',
  });

  // Package manager
  const packageManager = await select({
    message: 'Which package manager?',
    choices: [
      { name: '📦 npm', value: 'npm' },
      { name: '⚡ pnpm (Recommended)', value: 'pnpm' },
      { name: '🧶 yarn', value: 'yarn' },
    ],
    default: 'pnpm',
  });

  // Git initialization
  const useGit = await confirm({
    message: 'Initialize Git repository?',
    default: true,
  });

  // Create project
  console.log(chalk.magenta(`\n📦 Creating ${projectType} project: ${projectName}`));
  console.log(chalk.gray(`Runtime: ${runtime} | Package Manager: ${packageManager}`));
  console.log(chalk.gray(`Features: ${features.join(', ')}\n`));

  const spinner = ora({
    text: chalk.blue('Setting up your project...'),
    spinner: 'dots',
  }).start();

  await createProject({
    name: projectName,
    type: projectType,
    features,
    runtime,
    packageManager,
    useGit,
  });

  spinner.succeed(chalk.green('Project created successfully!'));

  const nextSteps = boxen(
    chalk.yellow.bold('🚀 Next steps:') +
      '\n\n' +
      chalk.white(`  cd ${projectName}`) +
      '\n' +
      chalk.white(`  ${packageManager} install`) +
      '\n' +
      chalk.white(`  ${packageManager} run dev`) +
      '\n\n' +
      chalk.gray('📚 Documentation: https://openspeed.dev'),
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'yellow',
    }
  );
  console.log(nextSteps);
}

// Template-based creation
async function createFromTemplate(template, name) {
  displayLogo();

  const templates = {
    api: {
      desc: 'REST API with authentication',
      features: ['auth', 'database', 'security', 'testing'],
    },
    web: {
      desc: 'Full-stack web app with JSX',
      features: ['auth', 'database', 'upload', 'security', 'testing'],
    },
    realtime: {
      desc: 'Real-time app with WebSocket',
      features: ['auth', 'database', 'websocket', 'security', 'testing'],
    },
    fullstack: {
      desc: 'Complete full-stack application',
      features: ['auth', 'database', 'upload', 'websocket', 'security', 'monitoring', 'testing'],
    },
  };

  if (!templates[template]) {
    console.error(chalk.red(`❌ Unknown template: ${template}`));
    console.log(
      chalk.yellow('Available templates:'),
      chalk.cyan(Object.keys(templates).join(', '))
    );
    process.exit(1);
  }

  const templateConfig = templates[template];
  console.log(chalk.magenta(`📦 Creating ${template} project (${templateConfig.desc})`));

  const spinner = ora({
    text: chalk.blue('Generating from template...'),
    spinner: 'dots',
  }).start();

  await createProject({
    name: name || `my-${template}-app`,
    type: template,
    features: templateConfig.features,
    runtime: 'bun',
    packageManager: 'pnpm',
    useGit: true,
  });

  spinner.succeed(chalk.green('Template project created!'));

  const projectName = name || `my-${template}-app`;
  const nextSteps = boxen(
    chalk.yellow.bold('🚀 Get started:') +
      '\n\n' +
      chalk.white(`  cd ${projectName}`) +
      '\n' +
      chalk.white('  pnpm install') +
      '\n' +
      chalk.white('  pnpm run dev'),
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'green',
    }
  );
  console.log(nextSteps);
}

// Plugin management
async function managePlugins(action, plugin) {
  displayLogo();

  switch (action) {
    case 'list': {
      const pluginsList = boxen(
        chalk.cyan.bold('📦 Available Plugins') +
          '\n\n' +
          chalk.white('  🔐 auth        - JWT authentication\n') +
          chalk.white('  🗄️ database    - Database adapters\n') +
          chalk.white('  📁 upload      - File upload handling\n') +
          chalk.white('  🔒 security    - Security middleware\n') +
          chalk.white('  📊 monitoring  - Metrics & logging\n') +
          chalk.white('  📧 email       - Email service\n') +
          chalk.white('  💳 stripe      - Payment processing\n') +
          chalk.white('  🧪 testing     - Testing utilities'),
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'blue',
        }
      );
      console.log(pluginsList);
      break;
    }

    case 'add':
      if (!plugin) {
        console.error(chalk.red('❌ Please specify a plugin to add'));
        return;
      }
      console.log(chalk.magenta(`📦 Adding plugin: ${plugin}`));
      // Implementation would go here
      break;

    case 'search':
      console.log(chalk.blue('🔍 Searching plugins...'));
      // Implementation would go here
      break;

    default:
      console.error(chalk.red(`❌ Unknown action: ${action}`));
  }
}

// Development server
async function startDevServer(options) {
  displayLogo();

  console.log(chalk.cyan(`🚀 Starting development server on ${options.host}:${options.port}`));

  // Check if we're in a project directory
  if (!existsSync('package.json')) {
    console.error(chalk.red('❌ Not in a project directory. Run "openspeed create" first.'));
    process.exit(1);
  }

  const spinner = ora({
    text: chalk.blue('Initializing development server...'),
    spinner: 'dots',
  }).start();

  // Start the development server
  const child = spawn('tsx', ['watch', 'src/index.ts'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: options.port, HOST: options.host },
  });

  child.on('error', (error) => {
   async function startDevServer(options) {
     try {
       displayLogo();

       console.log(chalk.cyan(`🚀 Starting development server on ${options.host}:${options.port}`));

       // Check if we're in a project directory
       if (!existsSync('package.json')) {
         console.error(chalk.red('❌ Not in a project directory. Run "openspeed create" first.'));
         console.log(chalk.yellow('💡 Tip: Use "openspeed create" to create a new project'));
         process.exit(1);
       }

       // Check if src/index.ts exists
       if (!existsSync('src/index.ts')) {
         console.error(chalk.red('❌ Main application file not found at src/index.ts'));
         console.log(chalk.yellow('💡 Make sure your main file is at src/index.ts'));
         process.exit(1);
       }

       // Check if tsx is available
       try {
         execSync('tsx --version', { stdio: 'ignore' });
       } catch {
         console.error(chalk.red('❌ tsx is not installed. Please install it:'));
         console.log(chalk.yellow('  npm install -D tsx'));
         process.exit(1);
       }

       const spinner = ora({
         text: chalk.blue('Initializing development server...'),
         spinner: 'dots',
       }).start();

       // Start the development server
       const child = spawn('tsx', ['watch', 'src/index.ts'], {
         stdio: 'inherit',
         env: { ...process.env, PORT: options.port, HOST: options.host },
       });

       child.on('error', (error) => {
         spinner.fail(chalk.red('Failed to start development server'));
         console.error(chalk.red('❌ Error:'), error.message);
         console.log(chalk.yellow('\n🔧 Troubleshooting:'));
         console.log('  • Check if the port is already in use');
         console.log('  • Verify your src/index.ts file syntax');
         console.log('  • Make sure all dependencies are installed');
         process.exit(1);
       });

       // Handle process termination
       process.on('SIGINT', () => {
         console.log(chalk.yellow('\n🛑 Shutting down development server...'));
         child.kill();
         process.exit(0);
       });

       // Wait a bit for server to start
       setTimeout(() => {
         spinner.succeed(chalk.green('Development server started!'));
         console.log(chalk.gray(`\n🌐 Open your browser to http://${options.host}:${options.port}`));
         console.log(chalk.gray('📝 Press Ctrl+C to stop the server'));
       }, 2000);

     } catch (error) {
       console.error(chalk.red('❌ Failed to start development server:'), error.message);
       process.exit(1);
     }
   }

// Client generation
async function generateClient(filename, options) {
  displayLogo();

  console.log(chalk.magenta(`📡 Generating client: ${filename}`));

  const spinner = ora({
    text: chalk.blue('Fetching client from server...'),
    spinner: 'dots',
  }).start();

  try {
    const ext = filename.split('.').pop();
    const endpoint = `/client.${ext}`;

    const response = await fetch(`${options.url}${endpoint}`);
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Server responded with ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
          errorMessage = errorJson.error;
        }
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    const clientCode = await response.text();
    await fs.writeFile(filename, clientCode);

    spinner.succeed(chalk.green(`Client generated successfully: ${filename}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to generate client'));
    console.error(chalk.red('❌ Error:'), error.message);
    throw error;
  }
}

// Code generation
async function generateCode(type, name) {
  displayLogo();

  console.log(chalk.magenta(`🔧 Generating ${type}: ${name}`));

  const spinner = ora({
    text: chalk.blue(`Creating ${type}...`),
    spinner: 'dots',
  }).start();

  try {
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
        throw new Error(`Unknown type: ${type}`);
    }
    spinner.succeed(chalk.green(`${type} generated successfully!`));
  } catch (error) {
    spinner.fail(chalk.red(`Failed to generate ${type}`));
    console.error(chalk.red('❌ Error:'), error.message);
    throw error;
  }
}

// Quick AI generation with interactive prompts
async function quickAIGenerate(options) {
  try {
    displayLogo();

    console.log(chalk.cyan.bold('🤖 OpenSpeed AI Code Generator'));
    console.log(chalk.gray('Generate production-ready code with AI assistance\n'));

    // Validate environment before proceeding
    await validateEnvironment();

    // Choose generation type
    const type = await select({
      message: 'What would you like to generate?',
      choices: [
        { name: '🔌 REST API (Complete CRUD)', value: 'api' },
        { name: '🖥️ React Component', value: 'component' },
        { name: '🗄️ Database Model', value: 'model' },
        { name: '🛡️ Middleware', value: 'middleware' },
        { name: '🔧 Plugin', value: 'plugin' },
        { name: '🧪 Test Suite', value: 'test' },
      ],
    });

    // Get name with auto-suggestions
    const name = await input({
      message: `Enter name for your ${type}:`,
      validate: (value) => {
        if (!value || value.length === 0) return 'Name is required';
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) {
          return 'Name must start with a letter and contain only letters, numbers, hyphens, and underscores';
        }
        return true;
      },
      transformer: (value) => value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
    });

    // Choose AI provider
    const provider = await select({
      message: 'Choose AI provider:',
      choices: [
        { name: '🤖 OpenAI GPT-4 (Most capable)', value: 'openai' },
        { name: '🧠 DeepSeek (Cost-effective)', value: 'deepseek' },
        { name: '🌐 OpenRouter (Multi-model)', value: 'openrouter' },
      ],
      default: options.provider,
    });

    // Validate provider API key
    await validateProvider(provider);

    // Confirm generation
    const confirmGen = await confirm({
      message: `Generate ${type} "${name}" using ${provider}?`,
      default: true,
    });

    if (!confirmGen) {
      console.log(chalk.yellow('Generation cancelled.'));
      return;
    }

    // Generate with AI
    const spinner = ora({
      text: chalk.blue(`🤖 Generating ${type} with ${provider}...`),
      spinner: 'dots',
    }).start();

    try {
      const generator = new AICodeGenerator();
      generator.cacheEnabled = !options.noCache;

      const generationPlan = await generator.generate(type, name, { provider });

      spinner.succeed(chalk.green('AI generation completed!'));

      console.log(chalk.magenta(`\n📋 Generated ${generationPlan.files.length} files:`));
      generationPlan.files.forEach((file) => {
        console.log(chalk.cyan(`  • ${file.path}`));
      });

      if (generationPlan.dependencies.length > 0) {
        console.log(chalk.yellow(`\n📦 Dependencies to install:`));
        console.log(chalk.gray(`  npm install ${generationPlan.dependencies.join(' ')}`));
      }

      console.log(chalk.green('\n✅ Code generation successful!'));

      // Show next steps
      showNextSteps(type, name);

    } catch (error) {
      spinner.fail(chalk.red('AI generation failed'));
      console.error(chalk.red('❌ Error:'), error.message);

      // Fallback to template generation
      console.log(chalk.yellow('\n🔄 Falling back to template generation...'));
      await generateCode(type, name);
    }
  } catch (error) {
    console.error(chalk.red('❌ Setup error:'), error.message);
    console.log(chalk.yellow('\n💡 Tips:'));
    console.log('  • Make sure you have Node.js installed');
    console.log('  • Set up your AI provider API keys');
    console.log('  • Check your internet connection');
    process.exit(1);
  }
}

// Environment validation
async function validateEnvironment() {
  // Check Node.js version
  const nodeVersion = process.versions.node;
  const majorVersion = parseInt(nodeVersion.split('.')[0]);

  if (majorVersion < 18) {
    throw new Error(`Node.js version ${nodeVersion} is not supported. Please upgrade to Node.js 18+`);
  }

  // Check if we're in a project directory (optional)
  try {
    await fs.access('package.json');
  } catch {
    console.log(chalk.yellow('⚠️  Not in a project directory. Generated files will be created in current directory.'));
  }
}

// Provider validation
async function validateProvider(provider) {
  const envVars = {
    openai: 'OPENAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
  };

  const envVar = envVars[provider];
  if (!process.env[envVar]) {
    throw new Error(`Missing ${envVar} environment variable. Please set your ${provider} API key.`);
  }

  // Test API key format (basic validation)
  const apiKey = process.env[envVar];
  if (apiKey.length < 20) {
    throw new Error(`Invalid ${envVar}: API key appears to be too short`);
  }
}

// Show next steps after generation
function showNextSteps(type, name) {
  const steps = {
    api: [
      'Review the generated controller, routes, and model files',
      'Update database configuration if needed',
      'Run tests to verify functionality',
      'Start your server and test the endpoints',
    ],
    component: [
      'Import the component in your React app',
      'Add it to your component library',
      'Test the component with different props',
      'Style it according to your design system',
    ],
    model: [
      'Update your database schema',
      'Run migrations if using a migration system',
      'Add the model to your application',
      'Test database operations',
    ],
    middleware: [
      'Import the middleware in your main app',
      'Configure middleware options',
      'Add it to your middleware chain',
      'Test middleware functionality',
    ],
    plugin: [
      'Review the generated plugin structure',
      'Implement plugin-specific logic',
      'Test plugin installation and functionality',
      'Publish to npm if desired',
    ],
    test: [
      'Run the generated tests',
      'Review test coverage',
      'Add more test cases as needed',
      'Integrate with your CI/CD pipeline',
    ],
  };

  const typeSteps = steps[type] || ['Review the generated files', 'Test functionality'];

  console.log(chalk.blue('\n🚀 Next steps:'));
  typeSteps.forEach((step, index) => {
    console.log(chalk.gray(`  ${index + 1}. ${step}`));
  });
}

// Show performance statistics
async function showPerformanceStats() {
  displayLogo();

  try {
    const { AICodeGenerator } = await import('./commands/generate.js');
    const generator = new AICodeGenerator();

    console.log(chalk.cyan.bold('📊 OpenSpeed AI Performance Statistics'));
    console.log(chalk.gray('Tracking AI code generation performance\n'));

    generator.logPerformanceStats();

    console.log(chalk.blue('\n💡 Tips for better performance:'));
    console.log('  • Use caching to avoid repeated API calls');
    console.log('  • Choose faster AI providers when available');
    console.log('  • Generate multiple files at once for parallel processing');
    console.log('  • Clear cache periodically: openspeed generate --clear-cache');

  } catch (error) {
    console.error(chalk.red('❌ Failed to load performance stats:'), error.message);
    process.exit(1);
  }
}

// Quick setup with sensible defaults
async function quickSetup(name, options) {
  displayLogo();

  try {
    const projectName = name || 'my-openspeed-app';
    const { type, runtime, packageManager } = options;

    console.log(chalk.cyan.bold('⚡ Quick OpenSpeed Setup'));
    console.log(chalk.gray(`Creating ${type} project: ${projectName}\n`));

    // Validate project name
    if (existsSync(projectName)) {
      console.error(chalk.red(`❌ Directory "${projectName}" already exists`));
      process.exit(1);
    }

    // Quick setup features based on type
    const quickFeatures = {
      api: ['auth', 'database', 'security', 'testing'],
      web: ['auth', 'database', 'upload', 'security', 'testing'],
      fullstack: ['auth', 'database', 'upload', 'websocket', 'security', 'monitoring', 'testing'],
    };

    const features = quickFeatures[type] || quickFeatures.api;

    const spinner = ora({
      text: chalk.blue('Setting up your project...'),
      spinner: 'dots',
    }).start();

    await createProject({
      name: projectName,
      type,
      features,
      runtime,
      packageManager,
      useGit: true,
    });

    spinner.succeed(chalk.green('Quick setup completed!'));

    const nextSteps = boxen(
      chalk.yellow.bold('🚀 Get started:') +
        '\n\n' +
        chalk.white(`  cd ${projectName}`) +
        '\n' +
        chalk.white(`  ${packageManager} install`) +
        '\n' +
        chalk.white(`  ${packageManager} run dev`) +
        '\n\n' +
        chalk.gray(`Runtime: ${runtime} | Type: ${type}`),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'green',
      }
    );
    console.log(nextSteps);

  } catch (error) {
    console.error(chalk.red('❌ Quick setup failed:'), error.message);
    process.exit(1);
  }
}

// Generate shell completion script
async function generateCompletion(shell) {
  displayLogo();

  console.log(chalk.cyan(`🐚 Generating ${shell} completion script...`));

  try {
    const completionScript = program.getCompletion(shell);

    if (!completionScript) {
      console.error(chalk.red(`❌ ${shell} completion not supported`));
      console.log(chalk.yellow('Supported shells: bash, zsh, fish'));
      process.exit(1);
    }

    // Output completion script
    console.log(chalk.green('\n📋 Add this to your shell configuration:'));
    console.log(chalk.gray('='.repeat(50)));
    console.log(completionScript);
    console.log(chalk.gray('='.repeat(50)));

    // Show installation instructions
    const instructions = {
      bash: `
# Add to ~/.bashrc or ~/.bash_profile:
echo '${completionScript}' >> ~/.bashrc
source ~/.bashrc`,
      zsh: `
# Add to ~/.zshrc:
echo '${completionScript}' >> ~/.zshrc
source ~/.zshrc`,
      fish: `
# Save as ~/.config/fish/completions/openspeed.fish:
echo '${completionScript}' > ~/.config/fish/completions/openspeed.fish`
    };

    if (instructions[shell]) {
      console.log(chalk.blue(`\n📝 Installation for ${shell}:`));
      console.log(chalk.gray(instructions[shell]));
    }

    console.log(chalk.green('\n✅ Completion script generated successfully!'));

  } catch (error) {
    console.error(chalk.red('❌ Failed to generate completion script:'), error.message);
    process.exit(1);
  }
}

// Project creation logic
async function createProject(config) {
  const { name, type, features, runtime, packageManager, useGit } = config;

  // Create directory
  if (existsSync(name)) {
    console.error(chalk.red(`❌ Directory "${name}" already exists`));
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
      'test:watch': 'vitest',
    },
    dependencies: getDependencies(features, runtime),
    devDependencies: getDevDependencies(features, runtime),
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
      forceConsistentCasingInFileNames: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
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
    case 'bun':
      return 'bun --hot src/index.ts';
    case 'deno':
      return 'deno run --watch --allow-net --allow-env src/index.ts';
    default:
      return 'tsx watch src/index.ts';
  }
}

function getDependencies(features, runtime) {
  const deps = {
    openspeed: '^0.7.1',
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
    typescript: '^5.0.0',
    tsx: '^4.0.0',
    vitest: '^1.0.0',
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
  // ⚠️ SECURITY WARNING: This is a placeholder for CLI scaffolding only!
  // In production, replace with proper JWT generation:
  // 1. Install jsonwebtoken: npm install jsonwebtoken
  // 2. Set JWT_SECRET in environment variables
  // 3. Use: import jwt from 'jsonwebtoken';
  //         const token = jwt.sign({ email, userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
  // 4. Verify password with bcrypt before issuing token

  // Placeholder token generation (DO NOT use in production)
  const crypto = require('crypto');
  const placeholderToken = \`dev_token_\${crypto.randomBytes(32).toString('hex')}\`;

  return ctx.json({
    success: true,
    token: placeholderToken,
    user: { email },
    warning: 'Using development placeholder token - implement proper JWT authentication before production'
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

${features.map((f) => `- ${f}`).join('\n')}

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
DATABASE_URL=mongodb://localhost:27017/my-app
# DATABASE_URL=postgresql://user:password@localhost:5432/my-app

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
  console.log(chalk.green(`✅ Created route: ${filename}`));
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
  console.log(chalk.green(`✅ Created model: ${filename}`));
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
  console.log(chalk.green(`✅ Created middleware: ${filename}`));
}

// Default action - show logo and help
if (process.argv.length === 2) {
  displayLogo();
  displayWelcome();
  program.help();
} else {
  program.parse();
}

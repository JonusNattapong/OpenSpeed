import { Command } from 'commander';
import { select, input, confirm, checkbox, number } from '@inquirer/prompts';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class AICodeGenerator {
  constructor() {
    this.generators = new Map();
    this.templates = new Map();
    this.lazyTemplates = new Map(); // Lazy loading cache for templates
    this.performanceMetrics = {
      totalGenerations: 0,
      averageGenerationTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      aiCalls: 0,
      templateFallbacks: 0,
    };

    // Configure AI providers
    this.providers = {
      openai: {
        name: 'OpenAI',
        apiKey:
          process.env.OPENAI_API_KEY ||
          (process.env.OPENAI_API_KEY_FILE
            ? readFileSync(process.env.OPENAI_API_KEY_FILE, 'utf8').trim()
            : undefined),
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-4',
      },
      deepseek: {
        name: 'DeepSeek',
        apiKey:
          process.env.DEEPSEEK_API_KEY ||
          (process.env.DEEPSEEK_API_KEY_FILE
            ? readFileSync(process.env.DEEPSEEK_API_KEY_FILE, 'utf8').trim()
            : undefined),
        baseURL: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
      },
      openrouter: {
        name: 'OpenRouter',
        apiKey:
          process.env.OPENROUTER_API_KEY ||
          (process.env.OPENROUTER_API_KEY_FILE
            ? readFileSync(process.env.OPENROUTER_API_KEY_FILE, 'utf8').trim()
            : undefined),
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'anthropic/claude-3-haiku',
      },
    };

    this.currentProvider = 'openai'; // Default provider
    this.useAI = !!this.providers[this.currentProvider]?.apiKey;

    if (this.useAI) {
      console.log(`🤖 AI Code Generation enabled (${this.providers[this.currentProvider].name})`);
    } else {
      console.log('📝 Template-based code generation (set API keys for AI features)');
      console.log('Available providers: OpenAI, DeepSeek, OpenRouter');
    }

    this.loadGenerators();
  }

  loadGenerators() {
    // API Generator
    this.generators.set('api', {
      name: 'REST API',
      description: 'Generate complete REST API endpoints with CRUD operations',
      templates: {
        controller: this.generateControllerTemplate.bind(this),
        routes: this.generateRoutesTemplate.bind(this),
        model: this.generateModelTemplate.bind(this),
        service: this.generateServiceTemplate.bind(this),
      },
    });

    // Component Generator
    this.generators.set('component', {
      name: 'UI Component',
      description: 'Generate reusable UI components with TypeScript support',
      templates: {
        component: this.generateComponentTemplate.bind(this),
        styles: this.generateStylesTemplate.bind(this),
        test: this.generateTestTemplate.bind(this),
        index: this.generateIndexTemplate.bind(this),
      },
    });

    // Database Model Generator
    this.generators.set('model', {
      name: 'Database Model',
      description: 'Generate database models with validation and relationships',
      templates: {
        model: this.generateDatabaseModelTemplate.bind(this),
        migration: this.generateMigrationTemplate.bind(this),
        seed: this.generateSeedTemplate.bind(this),
      },
    });

    // Middleware Generator
    this.generators.set('middleware', {
      name: 'Middleware',
      description: 'Generate custom middleware for authentication, validation, etc.',
      templates: {
        middleware: this.generateMiddlewareTemplate.bind(this),
        types: this.generateTypesTemplate.bind(this),
      },
    });

    // Plugin Generator
    this.generators.set('plugin', {
      name: 'Plugin',
      description: 'Generate OpenSpeed plugins with proper structure',
      templates: {
        plugin: this.generatePluginTemplate.bind(this),
        config: this.generatePluginConfigTemplate.bind(this),
        readme: this.generatePluginReadmeTemplate.bind(this),
      },
    });

    // Test Generator
    this.generators.set('test', {
      name: 'Test Suite',
      description: 'Generate comprehensive test suites with mocking',
      templates: {
        unit: this.generateUnitTestTemplate.bind(this),
        integration: this.generateIntegrationTestTemplate.bind(this),
        e2e: this.generateE2eTestTemplate.bind(this),
      },
    });
  }

  async generate(type, name, options = {}) {
    const startTime = Date.now();

    try {
      // Update provider if specified in options
      if (options.provider && this.providers[options.provider]) {
        this.currentProvider = options.provider;
        this.useAI = !!this.providers[this.currentProvider]?.apiKey;
      }

      const generator = this.generators.get(type);
      if (!generator) {
        throw new Error(`Unknown generator type: ${type}`);
      }

      console.log(`🔧 Generating ${generator.name}: ${name} (${this.currentProvider})`);

      const generationPlan = {
        type,
        name,
        files: [],
        dependencies: [],
        configuration: {},
      };

      // Generate files using AI or templates
      if (this.useAI) {
        console.log(`🤖 Using ${this.currentProvider} for code generation...`);
        const aiGeneratedFiles = await this.generateWithAI(type, name, options);
        generationPlan.files = aiGeneratedFiles;
      } else {
        console.log('📝 Using templates for code generation...');
        // Generate files based on templates with lazy loading
        for (const [templateType, templateFn] of Object.entries(generator.templates)) {
          const fileName = this.getFileName(type, templateType, name, options);
          const content = await this.getTemplateContent(templateType, templateFn, name, options);

          generationPlan.files.push({
            path: fileName,
            content,
            type: templateType,
          });
        }
      }

      // Add dependencies
      generationPlan.dependencies = this.getDependencies(type, options);

      // Add configuration
      generationPlan.configuration = this.getConfiguration(type, name, options);

      // Update performance metrics
      const generationTime = Date.now() - startTime;
      this.updatePerformanceMetrics(generationTime, generationPlan.files.length);

      return generationPlan;
    } catch (error) {
      // Update error metrics
      this.performanceMetrics.templateFallbacks++;
      throw error;
    }
  }

  getFileName(type, templateType, name, options) {
    const baseName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const fileNames = {
      api: {
        controller: `src/controllers/${baseName}.controller.ts`,
        routes: `src/routes/${baseName}.routes.ts`,
        model: `src/models/${baseName}.model.ts`,
        service: `src/services/${baseName}.service.ts`,
      },
      component: {
        component: `src/components/${baseName}/${baseName}.tsx`,
        styles: `src/components/${baseName}/${baseName}.module.css`,
        test: `src/components/${baseName}/${baseName}.test.tsx`,
        index: `src/components/${baseName}/index.ts`,
      },
      model: {
        model: `src/models/${baseName}.model.ts`,
        migration: `database/migrations/${Date.now()}-create-${baseName}.ts`,
        seed: `database/seeds/${baseName}.seed.ts`,
      },
      middleware: {
        middleware: `src/middleware/${baseName}.middleware.ts`,
        types: `src/types/${baseName}.types.ts`,
      },
      plugin: {
        plugin: `src/plugins/${baseName}.plugin.ts`,
        config: `src/plugins/${baseName}.config.ts`,
        readme: `src/plugins/${baseName}/README.md`,
      },
      test: {
        unit: `tests/unit/${baseName}.test.ts`,
        integration: `tests/integration/${baseName}.test.ts`,
        e2e: `tests/e2e/${baseName}.test.ts`,
      },
    };

    return fileNames[type]?.[templateType] || `${baseName}.${templateType}.ts`;
  }

  async generateWithAI(type, name, options = {}) {
    const generator = this.generators.get(type);
    const templateTypes = Object.keys(generator.templates);

    // Generate all files in parallel with performance monitoring
    const filePromises = templateTypes.map(async (templateType) => {
      const fileName = this.getFileName(type, templateType, name, options);
      const cacheKey = this.getCacheKey(type, name, templateType, options);

      // Check cache first
      if (this.cacheEnabled && this.cache.has(cacheKey)) {
        this.performanceMetrics.cacheHits++;
        console.log(`⚡ Using cached ${templateType}`);
        return {
          path: fileName,
          content: this.cache.get(cacheKey),
          type: templateType,
        };
      }

      this.performanceMetrics.cacheMisses++;
      const prompt = this.buildPrompt(type, templateType, name, options);

      try {
        const content = await this.callAI(prompt);
        this.performanceMetrics.aiCalls++;

        // Cache the result
        if (this.cacheEnabled) {
          this.cache.set(cacheKey, content);
        }

        console.log(`✅ Generated ${templateType} with AI`);
        return {
          path: fileName,
          content,
          type: templateType,
        };
      } catch (error) {
        console.warn(`⚠️ AI generation failed for ${templateType}, falling back to template`);
        this.performanceMetrics.templateFallbacks++;

        // Fallback to template with lazy loading
        const templateFn = generator.templates[templateType];
        const content = await this.getTemplateContent(templateType, templateFn, name, options);

        // Cache template result too
        if (this.cacheEnabled) {
          this.cache.set(cacheKey, content);
        }

        return {
          path: fileName,
          content,
          type: templateType,
        };
      }
    });

    // Wait for all files to be generated
    const files = await Promise.all(filePromises);
    return files;
  }

  buildPrompt(type, templateType, name, options) {
    const className = this.toPascalCase(name);
    const baseName = name.toLowerCase();

    const prompts = {
      api: {
        controller: `Generate a TypeScript controller class for ${className} with CRUD operations using OpenSpeed framework. Include proper error handling, validation, and response formatting.`,
        routes: `Generate TypeScript route definitions for ${className} API endpoints using OpenSpeed framework. Include all CRUD routes with proper middleware.`,
        model: `Generate a TypeScript interface and Zod schema for ${className} data model with validation.`,
        service: `Generate a TypeScript service class for ${className} with in-memory CRUD operations.`,
      },
      component: {
        component: `Generate a React TypeScript component for ${className} with modern hooks, proper TypeScript types, and accessibility.`,
        styles: `Generate CSS modules for ${className} component with modern styling, responsive design, and proper class naming.`,
        test: `Generate React Testing Library tests for ${className} component with comprehensive coverage.`,
        index: `Generate a TypeScript index file that exports the ${className} component and its types.`,
      },
      model: {
        model: `Generate a Sequelize TypeScript model for ${className} with proper types, validations, and associations.`,
        migration: `Generate a Sequelize migration file for creating ${baseName}s table with indexes.`,
        seed: `Generate a Sequelize seed file with sample data for ${className}.`,
      },
      middleware: {
        middleware: `Generate a TypeScript middleware class for ${className} functionality with proper OpenSpeed integration.`,
        types: `Generate TypeScript type definitions for ${className} middleware configuration and options.`,
      },
      plugin: {
        plugin: `Generate an OpenSpeed plugin class for ${className} with proper plugin interface implementation.`,
        config: `Generate TypeScript configuration interface and defaults for ${className} plugin.`,
        readme: `Generate a comprehensive README.md for ${className} plugin with installation and usage instructions.`,
      },
      test: {
        unit: `Generate Vitest unit tests for ${className} service with comprehensive test cases.`,
        integration: `Generate integration tests for ${className} API endpoints using Vitest and fetch.`,
        e2e: `Generate Playwright E2E tests for ${className} functionality with proper test scenarios.`,
      },
    };

    return (
      prompts[type]?.[templateType] ||
      `Generate ${templateType} for ${className} in ${type} category.`
    );
  }

  getCacheKey(type, name, templateType, options) {
    const optionsHash = this.hashOptions(options);
    return `${this.currentProvider}:${type}:${name}:${templateType}:${optionsHash}`;
  }

  hashOptions(options) {
    // Simple hash for options object
    const str = JSON.stringify(options);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  clearCache() {
    this.cache.clear();
    console.log('🧹 Cache cleared');
  }

  // Lazy loading for templates
  async getTemplateContent(templateType, templateFn, name, options) {
    const cacheKey = `template:${templateType}:${name}:${JSON.stringify(options)}`;

    if (this.lazyTemplates.has(cacheKey)) {
      return this.lazyTemplates.get(cacheKey);
    }

    const content = await templateFn(name, options);
    this.lazyTemplates.set(cacheKey, content);

    return content;
  }

  // Performance monitoring
  updatePerformanceMetrics(generationTime, fileCount) {
    this.performanceMetrics.totalGenerations++;
    this.performanceMetrics.averageGenerationTime =
      (this.performanceMetrics.averageGenerationTime *
        (this.performanceMetrics.totalGenerations - 1) +
        generationTime) /
      this.performanceMetrics.totalGenerations;
  }

  getPerformanceStats() {
    const stats = { ...this.performanceMetrics };
    stats.cacheHitRate = (stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100 || 0;
    stats.aiSuccessRate = ((stats.aiCalls - stats.templateFallbacks) / stats.aiCalls) * 100 || 0;

    return stats;
  }

  logPerformanceStats() {
    const stats = this.getPerformanceStats();
    console.log('\n📊 Performance Statistics:');
    console.log(`   Total generations: ${stats.totalGenerations}`);
    console.log(`   Average generation time: ${stats.averageGenerationTime.toFixed(0)}ms`);
    console.log(`   Cache hit rate: ${stats.cacheHitRate.toFixed(1)}%`);
    console.log(`   AI success rate: ${stats.aiSuccessRate.toFixed(1)}%`);
    console.log(`   Template fallbacks: ${stats.templateFallbacks}`);
  }

  async callAI(prompt) {
    const startTime = Date.now();
    const provider = this.providers[this.currentProvider];

    if (!provider.apiKey) {
      throw new Error(`No API key configured for ${provider.name}`);
    }

    try {
      const client = new OpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseURL,
      });

      const response = await client.chat.completions.create({
        model: provider.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert TypeScript and React developer. Generate clean, well-documented, and production-ready code. Follow best practices and include proper error handling.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const callTime = Date.now() - startTime;
      console.log(`⏱️  AI call completed in ${callTime}ms`);

      return response.choices[0].message.content.trim();
    } catch (error) {
      const callTime = Date.now() - startTime;
      console.warn(`❌ AI call failed after ${callTime}ms:`, error.message);
      throw error;
    }
  }

  async generateControllerTemplate(name, options) {
    const className = this.toPascalCase(name);
    const baseName = name.toLowerCase();

    return `import { createApp, Context } from 'openspeed';
import { ${className}Service } from '../services/${baseName}.service';
import { Create${className}Dto, Update${className}Dto } from '../types/${baseName}.types';

export class ${className}Controller {
  private service: ${className}Service;

  constructor() {
    this.service = new ${className}Service();
  }

  async getAll(ctx: Context) {
    try {
      const items = await this.service.findAll(ctx.query);
      ctx.json({ success: true, data: items });
    } catch (error) {
      ctx.json({ success: false, error: error.message }, 500);
    }
  }

  async getById(ctx: Context) {
    try {
      const { id } = ctx.params;
      const item = await this.service.findById(id);

      if (!item) {
        return ctx.json({ success: false, error: '${className} not found' }, 404);
      }

      ctx.json({ success: true, data: item });
    } catch (error) {
      ctx.json({ success: false, error: error.message }, 500);
    }
  }

  async create(ctx: Context) {
    try {
      const data: Create${className}Dto = ctx.body;
      const item = await this.service.create(data);
      ctx.json({ success: true, data: item }, 201);
    } catch (error) {
      ctx.json({ success: false, error: error.message }, 400);
    }
  }

  async update(ctx: Context) {
    try {
      const { id } = ctx.params;
      const data: Update${className}Dto = ctx.body;
      const item = await this.service.update(id, data);

      if (!item) {
        return ctx.json({ success: false, error: '${className} not found' }, 404);
      }

      ctx.json({ success: true, data: item });
    } catch (error) {
      ctx.json({ success: false, error: error.message }, 400);
    }
  }

  async delete(ctx: Context) {
    try {
      const { id } = ctx.params;
      const deleted = await this.service.delete(id);

      if (!deleted) {
        return ctx.json({ success: false, error: '${className} not found' }, 404);
      }

      ctx.json({ success: true, message: '${className} deleted successfully' });
    } catch (error) {
      ctx.json({ success: false, error: error.message }, 500);
    }
  }
}

// Factory function for dependency injection
export function create${className}Controller() {
  return new ${className}Controller();
}
`;
  }

  async generateRoutesTemplate(name, options) {
    const className = this.toPascalCase(name);
    const baseName = name.toLowerCase();

    return `import { createApp } from 'openspeed';
import { create${className}Controller } from '../controllers/${baseName}.controller';
import { validateBody, validateParams } from '../middleware/validation.middleware';

export function setup${className}Routes(app: ReturnType<typeof createApp>) {
  const controller = create${className}Controller();
  const basePath = '/api/${baseName}';

  // GET /api/${baseName} - Get all items
  app.get(basePath, controller.getAll.bind(controller));

  // GET /api/${baseName}/:id - Get item by ID
  app.get(\`\${basePath}/:id\`, controller.getById.bind(controller));

  // POST /api/${baseName} - Create new item
  app.post(
    basePath,
    validateBody('create${className}'),
    controller.create.bind(controller)
  );

  // PUT /api/${baseName}/:id - Update item
  app.put(
    \`\${basePath}/:id\`,
    validateParams('id'),
    validateBody('update${className}'),
    controller.update.bind(controller)
  );

  // DELETE /api/${baseName}/:id - Delete item
  app.delete(
    \`\${basePath}/:id\`,
    validateParams('id'),
    controller.delete.bind(controller)
  );
}
`;
  }

  async generateModelTemplate(name, options) {
    const className = this.toPascalCase(name);

    return `import { z } from 'zod';

export interface ${className} {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ${className}Schema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const Create${className}Schema = ${className}Schema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const Update${className}Schema = Create${className}Schema.partial();

export type Create${className}Dto = z.infer<typeof Create${className}Schema>;
export type Update${className}Dto = z.infer<typeof Update${className}Schema>;
`;
  }

  async generateServiceTemplate(name, options) {
    const className = this.toPascalCase(name);
    const baseName = name.toLowerCase();

    return `import { ${className}, Create${className}Dto, Update${className}Dto } from '../models/${baseName}.model';

export class ${className}Service {
  private items: Map<string, ${className}> = new Map();

  async findAll(query: any = {}): Promise<${className}[]> {
    const items = Array.from(this.items.values());

    // Apply filters
    if (query.search) {
      return items.filter(item =>
        item.name.toLowerCase().includes(query.search.toLowerCase()) ||
        item.description?.toLowerCase().includes(query.search.toLowerCase())
      );
    }

    return items;
  }

  async findById(id: string): Promise<${className} | null> {
    return this.items.get(id) || null;
  }

  async create(data: Create${className}Dto): Promise<${className}> {
    const id = crypto.randomUUID();
    const now = new Date();

    const item: ${className} = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now
    };

    this.items.set(id, item);
    return item;
  }

  async update(id: string, data: Update${className}Dto): Promise<${className} | null> {
    const existing = this.items.get(id);
    if (!existing) return null;

    const updated: ${className} = {
      ...existing,
      ...data,
      updatedAt: new Date()
    };

    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  // Additional business logic methods
  async findByName(name: string): Promise<${className} | null> {
    for (const item of this.items.values()) {
      if (item.name === name) return item;
    }
    return null;
  }

  async count(): Promise<number> {
    return this.items.size;
  }
}
`;
  }

  async generateComponentTemplate(name, options) {
    const className = this.toPascalCase(name);
    const baseName = name.toLowerCase();

    return `import React, { useState, useEffect } from 'react';
import styles from './${baseName}.module.css';

interface ${className}Props {
  title?: string;
  onAction?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export const ${className}: React.FC<${className}Props> = ({
  title = '${className}',
  onAction,
  variant = 'primary',
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      await onAction?.();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{title}</h2>

      <div className={styles.content}>
        <button
          className={\`\${styles.button} \${styles[variant]}\`}
          onClick={handleAction}
          disabled={disabled || isLoading}
        >
          {isLoading ? 'Loading...' : 'Click me'}
        </button>
      </div>
    </div>
  );
};

export default ${className};
`;
  }

  async generateStylesTemplate(name, options) {
    const baseName = name.toLowerCase();

    return `.container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.primary {
  background: #3b82f6;
  color: white;
}

.primary:hover:not(:disabled) {
  background: #2563eb;
}

.secondary {
  background: #6b7280;
  color: white;
}

.secondary:hover:not(:disabled) {
  background: #4b5563;
}

.danger {
  background: #ef4444;
  color: white;
}

.danger:hover:not(:disabled) {
  background: #dc2626;
}

@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }

  .button {
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
  }
}
`;
  }

  async generateTestTemplate(name, options) {
    const className = this.toPascalCase(name);
    const baseName = name.toLowerCase();

    return `import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ${className} } from './${baseName}';

describe('${className}', () => {
  const defaultProps = {
    title: 'Test ${className}',
    onAction: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default props', () => {
    render(<${className} {...defaultProps} />);
    expect(screen.getByText('Test ${className}')).toBeInTheDocument();
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onAction when button is clicked', async () => {
    render(<${className} {...defaultProps} />);
    const button = screen.getByText('Click me');

    fireEvent.click(button);

    await waitFor(() => {
      expect(defaultProps.onAction).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state during action', async () => {
    const slowAction = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(<${className} {...defaultProps} onAction={slowAction} />);
    const button = screen.getByText('Click me');

    fireEvent.click(button);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });
  });

  it('is disabled when disabled prop is true', () => {
    render(<${className} {...defaultProps} disabled={true} />);
    const button = screen.getByText('Click me');
    expect(button).toBeDisabled();
  });

  it('applies correct variant classes', () => {
    const { rerender } = render(<${className} {...defaultProps} variant="secondary" />);
    const button = screen.getByText('Click me');
    expect(button).toHaveClass('secondary');

    rerender(<${className} {...defaultProps} variant="danger" />);
    expect(button).toHaveClass('danger');
  });
});
`;
  }

  async generateIndexTemplate(name, options) {
    const className = this.toPascalCase(name);

    return `export { ${className}, default } from './${name.toLowerCase()}';
export type { ${className}Props } from './${name.toLowerCase()}';
`;
  }

  async generateDatabaseModelTemplate(name, options) {
    const className = this.toPascalCase(name);

    return `import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

export class ${className} extends Model {
  public id!: number;
  public name!: string;
  public description?: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}

${className}.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500]
      }
    }
  },
  {
    sequelize,
    modelName: '${className}',
    tableName: '${name.toLowerCase()}s',
    timestamps: true,
    indexes: [
      {
        fields: ['name'],
        unique: false
      }
    ]
  }
);

export default ${className};
`;
  }

  async generateMigrationTemplate(name, options) {
    const timestamp = Date.now();
    const baseName = name.toLowerCase();

    return `'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('${baseName}s', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('${baseName}s', ['name']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('${baseName}s');
  }
};
`;
  }

  async generateSeedTemplate(name, options) {
    const className = this.toPascalCase(name);
    const baseName = name.toLowerCase();

    return `'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('${baseName}s', [
      {
        name: 'Sample ${className} 1',
        description: 'This is a sample ${baseName} for testing purposes.',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Sample ${className} 2',
        description: 'Another sample ${baseName} with different data.',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('${baseName}s', null, {});
  }
};
`;
  }

  async generateMiddlewareTemplate(name, options) {
    const className = this.toPascalCase(name);
    const baseName = name.toLowerCase();

    return `import { Context, Next } from 'openspeed';

export interface ${className}Options {
  enabled?: boolean;
  maxRequests?: number;
  windowMs?: number;
}

export class ${className}Middleware {
  private options: Required<${className}Options>;

  constructor(options: ${className}Options = {}) {
    this.options = {
      enabled: true,
      maxRequests: 100,
      windowMs: 15 * 60 * 1000, // 15 minutes
      ...options
    };
  }

  async execute(ctx: Context, next: Next) {
    if (!this.options.enabled) {
      return next();
    }

    // Middleware logic here
    const startTime = Date.now();

    try {
      // Pre-processing
      console.log(\`[${className}] Processing request: \${ctx.method} \${ctx.path}\`);

      await next();

      // Post-processing
      const duration = Date.now() - startTime;
      console.log(\`[${className}] Request completed in \${duration}ms\`);

    } catch (error) {
      console.error(\`[${className}] Error:\`, error);
      throw error;
    }
  }
}

// Factory function
export function create${className}Middleware(options?: ${className}Options) {
  const middleware = new ${className}Middleware(options);
  return middleware.execute.bind(middleware);
}
`;
  }

  async generateTypesTemplate(name, options) {
    const className = this.toPascalCase(name);

    return `export interface ${className}Config {
  enabled: boolean;
  threshold: number;
  timeout: number;
}

export interface ${className}Metrics {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  lastUpdated: Date;
}

export interface ${className}Result {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    duration: number;
    timestamp: Date;
  };
}
`;
  }

  async generatePluginTemplate(name, options) {
    const className = this.toPascalCase(name);
    const baseName = name.toLowerCase();

    return `import { Plugin, Context, Next } from 'openspeed';
import { ${className}Config } from './${baseName}.config';

export class ${className}Plugin implements Plugin {
  private config: ${className}Config;
  private metrics: Map<string, number> = new Map();

  constructor(config: Partial<${className}Config> = {}) {
    this.config = {
      enabled: true,
      priority: 1,
      ...config
    };
  }

  get name(): string {
    return '${baseName}';
  }

  get version(): string {
    return '1.0.0';
  }

  async install(app: any) {
    if (this.config.enabled) {
      console.log(\`[${className}Plugin] Installing ${this.name} v\${this.version}\`);

      // Register middleware
      app.use(this.middleware.bind(this));

      // Register routes if any
      this.registerRoutes(app);
    }
  }

  async uninstall(app: any) {
    console.log(\`[${className}Plugin] Uninstalling ${this.name}\`);

    // Cleanup logic here
    this.metrics.clear();
  }

  private async middleware(ctx: Context, next: Next) {
    const startTime = Date.now();

    try {
      // Plugin logic here
      console.log(\`[${this.name}] Processing request: \${ctx.method} \${ctx.path}\`);

      await next();

      const duration = Date.now() - startTime;
      this.recordMetric('response_time', duration);

    } catch (error) {
      this.recordMetric('errors', 1);
      throw error;
    }
  }

  private registerRoutes(app: any) {
    // Register plugin-specific routes
    app.get(\`/api/${baseName}/status\`, this.getStatus.bind(this));
    app.get(\`/api/${baseName}/metrics\`, this.getMetrics.bind(this));
  }

  private getStatus(ctx: Context) {
    ctx.json({
      name: this.name,
      version: this.version,
      enabled: this.config.enabled,
      status: 'active'
    });
  }

  private getMetrics(ctx: Context) {
    const metrics = Object.fromEntries(this.metrics);
    ctx.json({
      plugin: this.name,
      metrics,
      timestamp: new Date().toISOString()
    });
  }

  private recordMetric(name: string, value: number) {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
  }
}

export default ${className}Plugin;
`;
  }

  async generatePluginConfigTemplate(name, options) {
    const className = this.toPascalCase(name);

    return `export interface ${className}Config {
  enabled: boolean;
  priority: number;
  options: {
    [key: string]: any;
  };
}

export const default${className}Config: ${className}Config = {
  enabled: true,
  priority: 1,
  options: {}
};
`;
  }

  async generatePluginReadmeTemplate(name, options) {
    const className = this.toPascalCase(name);
    const baseName = name.toLowerCase();

    return `# ${className} Plugin

A plugin for the OpenSpeed framework that provides ${baseName} functionality.

## Installation

\`\`\`bash
npm install @openspeed/${baseName}-plugin
\`\`\`

## Usage

\`\`\`typescript
import { createApp } from 'openspeed';
import ${className}Plugin from '@openspeed/${baseName}-plugin';

const app = createApp();

// Register the plugin
app.use(new ${className}Plugin({
  enabled: true,
  priority: 1
}));

app.listen(3000);
\`\`\`

## Configuration

\`\`\`typescript
const config = {
  enabled: true,
  priority: 1,
  options: {
    // Plugin-specific options
  }
};
\`\`\`

## API Endpoints

- \`GET /api/${baseName}/status\` - Get plugin status
- \`GET /api/${baseName}/metrics\` - Get plugin metrics

## License

MIT
`;
  }

  async generateUnitTestTemplate(name, options) {
    const className = this.toPascalCase(name);
    const baseName = name.toLowerCase();

    return `import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ${className}Service } from '../../src/services/${baseName}.service';

describe('${className}Service', () => {
  let service: ${className}Service;

  beforeEach(() => {
    service = new ${className}Service();
  });

  describe('findAll', () => {
    it('should return all items', async () => {
      const items = await service.findAll();
      expect(Array.isArray(items)).toBe(true);
    });

    it('should filter items by search query', async () => {
      // Create test data first
      await service.create({
        name: 'Test Item',
        description: 'Test description'
      });

      const results = await service.findAll({ search: 'Test' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('Test');
    });
  });

  describe('findById', () => {
    it('should return item by id', async () => {
      const created = await service.create({
        name: 'Test Item',
        description: 'Test description'
      });

      const found = await service.findById(created.id);
      expect(found).toEqual(created);
    });

    it('should return null for non-existent id', async () => {
      const found = await service.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('create', () => {
    it('should create new item', async () => {
      const data = {
        name: 'New Item',
        description: 'New description'
      };

      const created = await service.create(data);
      expect(created.id).toBeDefined();
      expect(created.name).toBe(data.name);
      expect(created.description).toBe(data.description);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('should update existing item', async () => {
      const created = await service.create({
        name: 'Original Name',
        description: 'Original description'
      });

      const updated = await service.update(created.id, {
        name: 'Updated Name'
      });

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe('Original description');
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    });

    it('should return null for non-existent id', async () => {
      const updated = await service.update('non-existent-id', { name: 'Test' });
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing item', async () => {
      const created = await service.create({
        name: 'Item to Delete',
        description: 'Will be deleted'
      });

      const deleted = await service.delete(created.id);
      expect(deleted).toBe(true);

      const found = await service.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent id', async () => {
      const deleted = await service.delete('non-existent-id');
      expect(deleted).toBe(false);
    });
  });
});
`;
  }

  async generateIntegrationTestTemplate(name, options) {
    const className = this.toPascalCase(name);
    const baseName = name.toLowerCase();

    return `import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from 'openspeed';
import { setup${className}Routes } from '../../src/routes/${baseName}.routes';

describe('${className} API Integration', () => {
  let app: ReturnType<typeof createApp>;
  let server: any;

  beforeAll(async () => {
    app = createApp();
    setup${className}Routes(app);

    server = app.listen(0); // Use random port
  });

  afterAll(async () => {
    await server.close();
  });

  describe('GET /api/${baseName}', () => {
    it('should return empty array initially', async () => {
      const response = await fetch(\`http://localhost:\${server.port}/api/${baseName}\`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);
    });
  });

  describe('POST /api/${baseName}', () => {
    it('should create new item', async () => {
      const newItem = {
        name: 'Integration Test Item',
        description: 'Created during integration test'
      };

      const response = await fetch(\`http://localhost:\${server.port}/api/${baseName}\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newItem)
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe(newItem.name);
      expect(data.data.id).toBeDefined();
    });
  });

  describe('GET /api/${baseName}/:id', () => {
    let createdItem: any;

    beforeAll(async () => {
      // Create an item for testing
      const response = await fetch(\`http://localhost:\${server.port}/api/${baseName}\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Item for GET',
          description: 'Used in GET test'
        })
      });

      const data = await response.json();
      createdItem = data.data;
    });

    it('should return item by id', async () => {
      const response = await fetch(\`http://localhost:\${server.port}/api/${baseName}/\${createdItem.id}\`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(createdItem.id);
      expect(data.data.name).toBe(createdItem.name);
    });

    it('should return 404 for non-existent id', async () => {
      const response = await fetch(\`http://localhost:\${server.port}/api/${baseName}/non-existent-id\`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
  });

  describe('PUT /api/${baseName}/:id', () => {
    let createdItem: any;

    beforeAll(async () => {
      // Create an item for testing
      const response = await fetch(\`http://localhost:\${server.port}/api/${baseName}\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Original Name',
          description: 'Original description'
        })
      });

      const data = await response.json();
      createdItem = data.data;
    });

    it('should update item', async () => {
      const updates = {
        name: 'Updated Name',
        description: 'Updated description'
      };

      const response = await fetch(\`http://localhost:\${server.port}/api/${baseName}/\${createdItem.id}\`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe(updates.name);
      expect(data.data.description).toBe(updates.description);
    });
  });

  describe('DELETE /api/${baseName}/:id', () => {
    let createdItem: any;

    beforeAll(async () => {
      // Create an item for testing
      const response = await fetch(\`http://localhost:\${server.port}/api/${baseName}\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Item to Delete',
          description: 'Will be deleted in test'
        })
      });

      const data = await response.json();
      createdItem = data.data;
    });

    it('should delete item', async () => {
      const response = await fetch(\`http://localhost:\${server.port}/api/${baseName}/\${createdItem.id}\`, {
        method: 'DELETE'
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');

      // Verify item is deleted
      const getResponse = await fetch(\`http://localhost:\${server.port}/api/${baseName}/\${createdItem.id}\`);
      expect(getResponse.status).toBe(404);
    });
  });
});
`;
  }

  async generateE2eTestTemplate(name, options) {
    const className = this.toPascalCase(name);
    const baseName = name.toLowerCase();

    return `import { test, expect } from '@playwright/test';

test.describe('${className} E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
  });

  test('should load the main page', async ({ page }) => {
    await expect(page).toHaveTitle(/OpenSpeed/);
  });

  test('should create new ${baseName}', async ({ page }) => {
    // Navigate to ${baseName} creation page
    await page.goto('/${baseName}/new');

    // Fill out the form
    await page.fill('[data-testid="${baseName}-name"]', 'E2E Test ${className}');
    await page.fill('[data-testid="${baseName}-description"]', 'Created during E2E test');

    // Submit the form
    await page.click('[data-testid="submit-${baseName}"]');

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('successfully created');
  });

  test('should list ${baseName}s', async ({ page }) => {
    await page.goto('/${baseName}');

    // Check if the list loads
    await expect(page.locator('[data-testid="${baseName}-list"]')).toBeVisible();

    // Verify at least one item exists (from previous test)
    const items = page.locator('[data-testid="${baseName}-item"]');
    await expect(items.first()).toBeVisible();
  });

  test('should edit ${baseName}', async ({ page }) => {
    await page.goto('/${baseName}');

    // Click edit on the first item
    await page.click('[data-testid="edit-${baseName}"]').first();

    // Update the name
    await page.fill('[data-testid="${baseName}-name"]', 'Updated E2E Test ${className}');

    // Submit the form
    await page.click('[data-testid="submit-${baseName}"]');

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('successfully updated');
  });

  test('should delete ${baseName}', async ({ page }) => {
    await page.goto('/${baseName}');

    // Get initial count
    const initialCount = await page.locator('[data-testid="${baseName}-item"]').count();

    // Click delete on the first item
    page.on('dialog', dialog => dialog.accept());
    await page.click('[data-testid="delete-${baseName}"]').first();

    // Verify the item was removed
    await expect(page.locator('[data-testid="${baseName}-item"]')).toHaveCount(initialCount - 1);
  });

  test('should handle validation errors', async ({ page }) => {
    await page.goto('/${baseName}/new');

    // Try to submit without required fields
    await page.click('[data-testid="submit-${baseName}"]');

    // Verify validation errors are shown
    await expect(page.locator('[data-testid="error-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-name"]')).toContainText('required');
  });
});
`;
  }

  getDependencies(type, options) {
    const deps = {
      api: ['zod', 'crypto'],
      component: ['react', '@testing-library/react', '@testing-library/jest-dom'],
      model: ['sequelize', 'zod'],
      middleware: [],
      plugin: [],
      test: ['vitest', '@playwright/test'],
    };

    return deps[type] || [];
  }

  getConfiguration(type, name, options) {
    const configs = {
      api: {
        basePath: `/api/${name.toLowerCase()}`,
        pagination: true,
        sorting: true,
        filtering: true,
      },
      component: {
        typescript: true,
        cssModules: true,
        testing: true,
      },
      model: {
        database: 'postgresql',
        timestamps: true,
        indexes: true,
      },
      middleware: {
        enabled: true,
        priority: 1,
      },
      plugin: {
        enabled: true,
        priority: 1,
        autoStart: true,
      },
      test: {
        framework: 'vitest',
        e2e: 'playwright',
        coverage: true,
      },
    };

    return configs[type] || {};
  }

  toPascalCase(str) {
    return str
      .split(/[-_\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  async writeFiles(generationPlan, targetDir, options = {}) {
    console.log(`📁 Creating ${generationPlan.files.length} files...`);

    for (const file of generationPlan.files) {
      const filePath = join(targetDir, file.path);
      const dirPath = dirname(filePath);

      // Create directory if it doesn't exist
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }

      // Write file
      await fs.writeFile(filePath, file.content, 'utf-8');
      console.log(`✅ Created ${file.path}`);
    }

    return generationPlan;
  }
}

export function generateCommand() {
  const cmd = new Command('generate')
    .description('🔧 AI-powered code generation utilities')
    .argument('<type>', 'Type of code to generate')
    .argument('<name>', 'Name of the component to generate')
    .option('-o, --output <dir>', 'Output directory', process.cwd())
    .option('-t, --template <template>', 'Specific template to use')
    .option('-f, --force', 'Overwrite existing files')
    .option('-d, --dry-run', 'Show what would be generated without creating files')
    .option('-y, --yes', 'Skip confirmations')
    .option(
      '-p, --provider <provider>',
      'AI provider to use (openai, deepseek, openrouter)',
      'openai'
    )
    .option('--no-cache', 'Disable caching for this generation')
    .option('--clear-cache', 'Clear the generation cache')
    .option('--format', 'Auto-format generated code with Prettier')
    .option('--lint', 'Run ESLint on generated code')
    .action(async (type, name, options) => {
      try {
        const generator = new AICodeGenerator();

        // Handle cache clearing
        if (options.clearCache) {
          generator.clearCache();
          console.log('✅ Cache cleared successfully');
          return;
        }

        // Disable cache if requested
        if (options.noCache) {
          generator.cacheEnabled = false;
        }

        if (!generator.generators.has(type)) {
          console.error(`❌ Unknown generator type: ${type}`);
          console.log('\nAvailable types:');
          for (const [genType, gen] of generator.generators) {
            console.log(`• ${genType} - ${gen.description}`);
          }
          process.exit(1);
        }

        console.log('🚀 OpenSpeed AI Code Generator');
        console.log('==============================');

        // Generate the code
        console.log(`\n🔧 Generating ${type}: ${name}...`);
        const generationPlan = await generator.generate(type, name, options);

        console.log('\n📋 Generation Plan:');
        console.log(`Type: ${generationPlan.type}`);
        console.log(`Name: ${generationPlan.name}`);
        console.log(`Files to create: ${generationPlan.files.length}`);

        if (generationPlan.dependencies.length > 0) {
          console.log(`Dependencies: ${generationPlan.dependencies.join(', ')}`);
        }

        console.log('\n📁 Files:');
        generationPlan.files.forEach((file) => {
          console.log(`• ${file.path}`);
        });

        if (options.dryRun) {
          console.log('\n🔍 Dry run - no files created');
          return;
        }

        // Confirm generation
        if (!options.yes) {
          const confirmed = await confirm({
            message: `Generate ${generationPlan.files.length} files in ${options.output}?`,
            default: false,
          });

          if (!confirmed) {
            console.log('Generation cancelled.');
            return;
          }
        }

        // Check for existing files
        const existingFiles = [];
        for (const file of generationPlan.files) {
          const filePath = join(options.output, file.path);
          if (existsSync(filePath) && !options.force) {
            existingFiles.push(file.path);
          }
        }

        if (existingFiles.length > 0) {
          console.log('\n⚠️  Existing files found:');
          existingFiles.forEach((file) => console.log(`• ${file}`));

          if (!options.force) {
            const overwrite = await confirm({
              message: 'Overwrite existing files?',
              default: false,
            });

            if (!overwrite) {
              console.log('Generation cancelled.');
              return;
            }
          }
        }

        // Generate files
        await generator.writeFiles(generationPlan, options.output, options);

        // Auto-format generated files
        if (options.format) {
          console.log('\n🔧 Formatting generated code...');
          await formatGeneratedFiles(generationPlan.files, options.output);
        }

        // Run linter on generated files
        if (options.lint) {
          console.log('\n🔍 Running linter on generated code...');
          await lintGeneratedFiles(generationPlan.files, options.output);
        }

        console.log('\n✅ Generation Complete!');
        console.log(`Created ${generationPlan.files.length} files`);

        if (generationPlan.dependencies.length > 0) {
          console.log('\n📦 Install dependencies:');
          console.log(`npm install ${generationPlan.dependencies.join(' ')}`);
        }

        console.log('\n🚀 Next steps:');
        console.log('1. Review generated files');
        console.log('2. Install dependencies if needed');
        console.log('3. Run tests to verify functionality');
        console.log('4. Integrate with your application');
      } catch (error) {
        console.error('❌ Generation failed:', error.message);
        process.exit(1);
      }
    });

  // Add subcommands for different generator types
  for (const [type, generator] of new AICodeGenerator().generators) {
    cmd.addCommand(
      new Command(type)
        .description(generator.description)
        .argument('<name>', `Name of the ${type} to generate`)
        .option('-o, --output <dir>', 'Output directory', process.cwd())
        .option('-f, --force', 'Overwrite existing files')
        .option('-d, --dry-run', 'Show what would be generated')
        .option(
          '-p, --provider <provider>',
          'AI provider to use (openai, deepseek, openrouter)',
          'openai'
        )
        .option('--no-cache', 'Disable caching for this generation')
        .option('--format', 'Auto-format generated code with Prettier')
        .option('--lint', 'Run ESLint on generated code')
        .action(async (name, options) => {
          // Reuse the main action with the specific type
          await cmd.action(type, name, options);
        })
    );
  }

  return cmd;
}

// Helper functions for formatting and linting
async function formatGeneratedFiles(files, outputDir) {
  try {
    const prettier = await import('prettier');
    const fs = await import('fs/promises');
    const path = await import('path');

    for (const file of files) {
      const filePath = path.join(outputDir, file.path);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const formatted = await prettier.format(content, {
          filepath: filePath,
          semi: true,
          singleQuote: true,
          tabWidth: 2,
          useTabs: false,
        });

        await fs.writeFile(filePath, formatted, 'utf-8');
        console.log(`✅ Formatted ${file.path}`);
      } catch (error) {
        console.warn(`⚠️ Failed to format ${file.path}:`, error.message);
      }
    }
  } catch (error) {
    console.warn('⚠️ Prettier not available, skipping formatting');
  }
}

async function lintGeneratedFiles(files, outputDir) {
  try {
    const { ESLint } = await import('eslint');
    const path = await import('path');

    const eslint = new ESLint({
      fix: true,
      useEslintrc: true,
    });

    const filePaths = files.map((file) => path.join(outputDir, file.path));

    const results = await eslint.lintFiles(filePaths);

    // Apply fixes
    await ESLint.outputFixes(results);

    // Report issues
    const formatter = await eslint.loadFormatter('stylish');
    const resultText = formatter.format(results);

    if (resultText.trim()) {
      console.log('\n📋 Linting Results:');
      console.log(resultText);
    } else {
      console.log('✅ No linting issues found');
    }
  } catch (error) {
    console.warn('⚠️ ESLint not available, skipping linting');
  }
}

import { Command } from 'commander';
import { select, input, confirm, checkbox } from '@inquirer/prompts';
import fs from 'fs/promises';
import { existsSync, mkdirSync, statSync, readdirSync } from 'fs';
import { join, dirname, extname, relative, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class AIMigrationEngine {
  constructor() {
    this.migrationStrategies = new Map();
    this.analysisResults = new Map();
    this.transformationRules = new Map();
    this.loadMigrationStrategies();
  }

  loadMigrationStrategies() {
    // Express.js migration strategy
    this.migrationStrategies.set('express', {
      name: 'Express.js',
      patterns: {
        imports: [/import express from ['"]express['"]/],
        app: [/express\(\)/, /app\.listen/],
        routes: [/app\.(get|post|put|delete|patch)/],
        middleware: [/app\.use/]
      },
      transformations: {
        imports: 'import { createApp } from "openspeed";',
        app: 'const app = createApp();',
        routes: (match) => match.replace('app.', 'app.'),
        middleware: (match) => match.replace('app.use', 'app.use')
      }
    });

    // Hono migration strategy
    this.migrationStrategies.set('hono', {
      name: 'Hono',
      patterns: {
        imports: [/import \{ Hono \} from ['"]hono['"]/],
        app: [/new Hono\(\)/],
        routes: [/\.get\(|\.post\(|\.put\(|\.delete\(|\.patch\(/],
        middleware: [/\.use\(/]
      },
      transformations: {
        imports: 'import { createApp } from "openspeed";',
        app: 'const app = createApp();',
        routes: (match) => match,
        middleware: (match) => match
      }
    });

    // Elysia migration strategy
    this.migrationStrategies.set('elysia', {
      name: 'Elysia',
      patterns: {
        imports: [/import \{ Elysia \} from ['"]elysia['"]/],
        app: [/new Elysia\(\)/],
        routes: [/\.(get|post|put|delete|patch)\(/],
        middleware: [/\.use\(/]
      },
      transformations: {
        imports: 'import { createApp } from "openspeed";',
        app: 'const app = createApp();',
        routes: (match) => match,
        middleware: (match) => match
      }
    });
  }

  async analyzeCodebase(sourceDir) {
    console.log('🔍 AI analyzing codebase for migration...');

    const analysis = {
      framework: null,
      files: [],
      dependencies: new Map(),
      routes: [],
      middleware: [],
      complexity: 0,
      migrationConfidence: 0,
      recommendations: []
    };

    // Recursively scan directory
    const scanDirectory = async (dir, relativePath = '') => {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = join(relativePath, entry.name);

        if (entry.isDirectory()) {
          // Skip common non-source directories
          if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
            await scanDirectory(fullPath, relPath);
          }
        } else if (entry.isFile() && ['.js', '.ts', '.jsx', '.tsx', '.mjs'].includes(extname(entry.name))) {
          const fileAnalysis = await this.analyzeFile(fullPath, relPath);
          if (fileAnalysis) {
            analysis.files.push(fileAnalysis);
          }
        }
      }
    };

    await scanDirectory(sourceDir);

    // Determine framework
    analysis.framework = this.detectFramework(analysis.files);

    // Analyze dependencies
    analysis.dependencies = await this.analyzeDependencies(sourceDir);

    // Calculate complexity and confidence
    analysis.complexity = this.calculateComplexity(analysis.files);
    analysis.migrationConfidence = this.calculateMigrationConfidence(analysis);

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis);

    this.analysisResults.set(sourceDir, analysis);
    return analysis;
  }

  async analyzeFile(filePath, relativePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = statSync(filePath);

      const fileAnalysis = {
        path: relativePath,
        size: stats.size,
        lines: content.split('\n').length,
        framework: null,
        routes: [],
        middleware: [],
        imports: [],
        exports: [],
        complexity: 0
      };

      // Analyze imports
      const importMatches = content.match(/import\s+.*?\s+from\s+['"][^'"]+['"]/g) || [];
      fileAnalysis.imports = importMatches.map(imp => {
        const match = imp.match(/from\s+['"]([^'"]+)['"]/);
        return match ? match[1] : '';
      });

      // Detect framework patterns
      for (const [frameworkId, strategy] of this.migrationStrategies) {
        if (strategy.patterns.imports.some(pattern => pattern.test(content))) {
          fileAnalysis.framework = frameworkId;
          break;
        }
      }

      // Analyze routes
      for (const [frameworkId, strategy] of this.migrationStrategies) {
        if (fileAnalysis.framework === frameworkId) {
          const routeMatches = content.match(new RegExp(strategy.patterns.routes.join('|'), 'g')) || [];
          fileAnalysis.routes = routeMatches;
        }
      }

      // Analyze middleware
      for (const [frameworkId, strategy] of this.migrationStrategies) {
        if (fileAnalysis.framework === frameworkId) {
          const middlewareMatches = content.match(new RegExp(strategy.patterns.middleware.join('|'), 'g')) || [];
          fileAnalysis.middleware = middlewareMatches;
        }
      }

      // Calculate file complexity
      fileAnalysis.complexity = this.calculateFileComplexity(content);

      return fileAnalysis;
    } catch (error) {
      console.warn(`⚠️ Could not analyze ${relativePath}:`, error.message);
      return null;
    }
  }

  detectFramework(files) {
    const frameworkCounts = new Map();

    for (const file of files) {
      if (file.framework) {
        frameworkCounts.set(file.framework, (frameworkCounts.get(file.framework) || 0) + 1);
      }
    }

    let maxCount = 0;
    let detectedFramework = null;

    for (const [framework, count] of frameworkCounts) {
      if (count > maxCount) {
        maxCount = count;
        detectedFramework = framework;
      }
    }

    return detectedFramework;
  }

  async analyzeDependencies(sourceDir) {
    const dependencies = new Map();

    try {
      const packageJsonPath = join(sourceDir, 'package.json');
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

        // Combine all dependency types
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };

        for (const [name, version] of Object.entries(allDeps)) {
          dependencies.set(name, version);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not analyze package.json:', error.message);
    }

    return dependencies;
  }

  calculateComplexity(files) {
    let totalComplexity = 0;

    for (const file of files) {
      totalComplexity += file.complexity;
    }

    // Normalize to 1-10 scale
    return Math.min(Math.max(Math.round(totalComplexity / files.length / 10), 1), 10);
  }

  calculateFileComplexity(content) {
    let complexity = 0;

    // Count various complexity indicators
    complexity += (content.match(/\b(if|for|while|switch|catch)\b/g) || []).length;
    complexity += (content.match(/\b(function|class|=>)\b/g) || []).length;
    complexity += (content.match(/\b(await|async|Promise)\b/g) || []).length;

    return complexity;
  }

  calculateMigrationConfidence(analysis) {
    if (!analysis.framework) return 0;

    let confidence = 50; // Base confidence

    // Framework detection increases confidence
    if (analysis.framework) confidence += 20;

    // More files = more complex migration
    if (analysis.files.length > 20) confidence -= 10;
    else if (analysis.files.length > 10) confidence -= 5;

    // Complexity affects confidence
    if (analysis.complexity > 7) confidence -= 15;
    else if (analysis.complexity > 5) confidence -= 10;

    return Math.max(0, Math.min(100, confidence));
  }

  generateRecommendations(analysis) {
    const recommendations = [];

    if (!analysis.framework) {
      recommendations.push('Could not detect framework. Manual migration may be required.');
      return recommendations;
    }

    const strategy = this.migrationStrategies.get(analysis.framework);
    recommendations.push(`Detected ${strategy.name} framework. Migration is feasible.`);

    if (analysis.migrationConfidence > 80) {
      recommendations.push('High confidence migration. Automated conversion should work well.');
    } else if (analysis.migrationConfidence > 60) {
      recommendations.push('Medium confidence. Some manual adjustments may be needed.');
    } else {
      recommendations.push('Low confidence. Significant manual migration work required.');
    }

    if (analysis.complexity > 7) {
      recommendations.push('High complexity codebase. Consider migrating in phases.');
    }

    if (analysis.files.length > 50) {
      recommendations.push('Large codebase. Consider using migration scripts for batch processing.');
    }

    return recommendations;
  }

  async generateMigrationPlan(analysis, targetDir) {
    console.log('📋 AI generating migration plan...');

    const plan = {
      phases: [],
      estimatedTime: '2-4 hours',
      riskLevel: 'Medium',
      backupStrategy: 'Create git branch before migration',
      rollbackPlan: 'Revert to previous git commit'
    };

    // Phase 1: Preparation
    plan.phases.push({
      name: 'Preparation',
      tasks: [
        'Create backup branch',
        'Install OpenSpeed dependencies',
        'Set up new project structure',
        'Configure build tools'
      ],
      automated: true
    });

    // Phase 2: Core Migration
    plan.phases.push({
      name: 'Core Migration',
      tasks: [
        'Convert main application file',
        'Migrate routes and handlers',
        'Transform middleware',
        'Update imports and exports'
      ],
      automated: analysis.migrationConfidence > 70
    });

    // Phase 3: Feature Migration
    plan.phases.push({
      name: 'Feature Migration',
      tasks: [
        'Migrate authentication',
        'Convert database operations',
        'Transform file uploads',
        'Update WebSocket connections'
      ],
      automated: false
    });

    // Phase 4: Testing and Validation
    plan.phases.push({
      name: 'Testing & Validation',
      tasks: [
        'Run automated tests',
        'Manual testing of endpoints',
        'Performance validation',
        'Security audit'
      ],
      automated: false
    });

    // Adjust estimates based on complexity
    if (analysis.complexity > 7) {
      plan.estimatedTime = '1-2 weeks';
      plan.riskLevel = 'High';
    } else if (analysis.complexity > 5) {
      plan.estimatedTime = '4-8 hours';
      plan.riskLevel = 'Medium';
    }

    return plan;
  }

  async performMigration(analysis, sourceDir, targetDir, options = {}) {
    console.log('🔄 Starting AI-powered migration...');

    const strategy = this.migrationStrategies.get(analysis.framework);
    if (!strategy) {
      throw new Error(`No migration strategy for ${analysis.framework}`);
    }

    // Create target directory
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const migrationResults = {
      migratedFiles: 0,
      skippedFiles: 0,
      errors: [],
      warnings: []
    };

    // Migrate each file
    for (const file of analysis.files) {
      try {
        const migrated = await this.migrateFile(file, sourceDir, targetDir, strategy, options);
        if (migrated) {
          migrationResults.migratedFiles++;
        } else {
          migrationResults.skippedFiles++;
        }
      } catch (error) {
        migrationResults.errors.push({
          file: file.path,
          error: error.message
        });
      }
    }

    // Generate new package.json
    await this.generateMigratedPackageJson(analysis, targetDir);

    // Create migration report
    await this.generateMigrationReport(migrationResults, targetDir);

    return migrationResults;
  }

  async migrateFile(file, sourceDir, targetDir, strategy, options) {
    const sourcePath = join(sourceDir, file.path);
    const targetPath = join(targetDir, file.path);

    // Ensure target directory exists
    const targetDirPath = dirname(targetPath);
    if (!existsSync(targetDirPath)) {
      mkdirSync(targetDirPath, { recursive: true });
    }

    const content = await fs.readFile(sourcePath, 'utf-8');
    let migratedContent = content;

    // Apply transformations
    migratedContent = this.applyTransformations(migratedContent, strategy);

    // Write migrated file
    await fs.writeFile(targetPath, migratedContent, 'utf-8');

    console.log(`✅ Migrated ${file.path}`);
    return true;
  }

  applyTransformations(content, strategy) {
    let transformed = content;

    // Transform imports
    for (const importPattern of strategy.patterns.imports) {
      transformed = transformed.replace(importPattern, strategy.transformations.imports);
    }

    // Transform app instantiation
    for (const appPattern of strategy.patterns.app) {
      transformed = transformed.replace(appPattern, strategy.transformations.app);
    }

    // Transform routes (keep similar for now, may need refinement)
    transformed = transformed.replace(
      /app\.(get|post|put|delete|patch)\(/g,
      (match, method) => `app.${method}(`
    );

    // Transform middleware
    transformed = transformed.replace(
      /app\.use\(/g,
      'app.use('
    );

    return transformed;
  }

  async generateMigratedPackageJson(analysis, targetDir) {
    const newPackageJson = {
      name: 'migrated-openspeed-app',
      version: '1.0.0',
      description: 'Migrated to OpenSpeed Framework',
      main: 'dist/src/index.js',
      type: 'module',
      scripts: {
        build: 'tsc -p tsconfig.build.json',
        start: 'node dist/src/index.js',
        dev: 'tsx watch src/index.ts',
        test: 'vitest run',
        'test:watch': 'vitest'
      },
      dependencies: {
        'openspeed': 'latest'
      },
      devDependencies: {
        'typescript': 'latest',
        'tsx': 'latest',
        'vitest': 'latest',
        '@types/node': 'latest'
      }
    };

    // Preserve some original dependencies that might still be needed
    const originalDeps = analysis.dependencies;
    for (const [name, version] of originalDeps) {
      if (['dotenv', 'cors', 'helmet', 'compression'].includes(name)) {
        newPackageJson.dependencies[name] = version;
      }
    }

    await fs.writeFile(
      join(targetDir, 'package.json'),
      JSON.stringify(newPackageJson, null, 2),
      'utf-8'
    );
  }

  async generateMigrationReport(results, targetDir) {
    const report = `# Migration Report

Generated: ${new Date().toISOString()}

## Summary
- **Files Migrated**: ${results.migratedFiles}
- **Files Skipped**: ${results.skippedFiles}
- **Errors**: ${results.errors.length}
- **Warnings**: ${results.warnings.length}

## Errors
${results.errors.map(e => `- ${e.file}: ${e.error}`).join('\n')}

## Warnings
${results.warnings.map(w => `- ${w}`).join('\n')}

## Next Steps
1. Review migrated files
2. Install dependencies: \`npm install\`
3. Run tests: \`npm test\`
4. Start development server: \`npm run dev\`
5. Manual testing and fixes as needed
`;

    await fs.writeFile(join(targetDir, 'MIGRATION_REPORT.md'), report, 'utf-8');
  }
}

export function migrateCommand() {
  const cmd = new Command('migrate')
    .description('🔄 AI-powered framework migration tools')
    .argument('[source]', 'Source directory to migrate from')
    .option('-t, --target <dir>', 'Target directory for migrated code')
    .option('-f, --framework <fw>', 'Source framework (express, hono, elysia)')
    .option('-a, --analyze-only', 'Only analyze, do not migrate')
    .option('-p, --plan-only', 'Generate migration plan only')
    .option('-y, --yes', 'Skip confirmations')
    .action(async (source, options) => {
      try {
        const migrator = new AIMigrationEngine();

        let sourceDir = source || process.cwd();
        let targetDir = options.target || join(process.cwd(), 'migrated-openspeed-app');

        if (!existsSync(sourceDir)) {
          console.error(`❌ Source directory does not exist: ${sourceDir}`);
          process.exit(1);
        }

        console.log('🚀 OpenSpeed Migration Engine');
        console.log('=============================');

        // Analyze codebase
        console.log(`\n🔍 Analyzing ${sourceDir}...`);
        const analysis = await migrator.analyzeCodebase(sourceDir);

        console.log('\n📊 Analysis Results:');
        console.log(`Framework: ${analysis.framework || 'Unknown'}`);
        console.log(`Files: ${analysis.files.length}`);
        console.log(`Complexity: ${analysis.complexity}/10`);
        console.log(`Migration Confidence: ${analysis.migrationConfidence}%`);

        if (analysis.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          analysis.recommendations.forEach(rec => console.log(`• ${rec}`));
        }

        if (options.analyzeOnly) {
          return;
        }

        if (!analysis.framework) {
          console.log('\n❌ Could not detect framework. Please specify with --framework');
          const framework = await select({
            message: 'Which framework are you migrating from?',
            choices: [
              { name: 'Express.js', value: 'express' },
              { name: 'Hono', value: 'hono' },
              { name: 'Elysia', value: 'elysia' },
              { name: 'Other', value: 'other' }
            ]
          });

          if (framework === 'other') {
            console.log('Custom migration not yet supported. Please use manual migration.');
            return;
          }

          analysis.framework = framework;
        }

        // Generate migration plan
        const plan = await migrator.generateMigrationPlan(analysis, targetDir);

        console.log('\n📋 Migration Plan:');
        console.log(`Estimated Time: ${plan.estimatedTime}`);
        console.log(`Risk Level: ${plan.riskLevel}`);
        console.log(`Backup: ${plan.backupStrategy}`);

        console.log('\n📝 Phases:');
        plan.phases.forEach((phase, index) => {
          console.log(`${index + 1}. ${phase.name} (${phase.automated ? 'Automated' : 'Manual'})`);
          phase.tasks.forEach(task => console.log(`   • ${task}`));
        });

        if (options.planOnly) {
          return;
        }

        // Confirm migration
        if (!options.yes) {
          const confirmed = await confirm({
            message: `Proceed with migration to ${targetDir}?`,
            default: false
          });

          if (!confirmed) {
            console.log('Migration cancelled.');
            return;
          }
        }

        // Perform migration
        console.log(`\n🔄 Migrating to ${targetDir}...`);
        const results = await migrator.performMigration(analysis, sourceDir, targetDir);

        console.log('\n✅ Migration Complete!');
        console.log(`Migrated Files: ${results.migratedFiles}`);
        console.log(`Skipped Files: ${results.skippedFiles}`);
        console.log(`Errors: ${results.errors.length}`);

        if (results.errors.length > 0) {
          console.log('\n❌ Errors encountered:');
          results.errors.forEach(error => {
            console.log(`• ${error.file}: ${error.error}`);
          });
        }

        console.log(`\n📄 Migration report saved to: ${join(targetDir, 'MIGRATION_REPORT.md')}`);
        console.log('\n🚀 Next steps:');
        console.log(`cd ${basename(targetDir)}`);
        console.log('npm install');
        console.log('npm run dev');

      } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}
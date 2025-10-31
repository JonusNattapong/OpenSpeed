import { Command } from 'commander';
import { select, input, confirm, checkbox } from '@inquirer/prompts';
import fs from 'fs/promises';
import { existsSync, statSync, readdirSync } from 'fs';
import { join, dirname, extname, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class AICodeAnalyzer {
  constructor() {
    this.analysisEngines = new Map();
    this.insights = new Map();
    this.metrics = new Map();
    this.loadAnalysisEngines();
  }

  loadAnalysisEngines() {
    // Performance Analysis Engine
    this.analysisEngines.set('performance', {
      name: 'Performance Analysis',
      patterns: {
        asyncOperations: [/\bawait\b/g, /\bPromise\b/g, /\basync\b/g],
        loops: [/\bfor\b/g, /\bwhile\b/g, /\bforEach\b/g, /\bmap\b/g],
        memory: [/\bnew\b/g, /\bBuffer\b/g, /\bArray\b/g],
        blocking: [/\breadFileSync\b/g, /\bwriteFileSync\b/g]
      },
      calculateScore: (matches) => {
        let score = 100;
        score -= matches.blocking.length * 10; // Blocking operations
        score -= matches.loops.length * 2; // Potential optimization points
        score += matches.asyncOperations.length * 5; // Good async usage
        return Math.max(0, Math.min(100, score));
      }
    });

    // Security Analysis Engine
    this.analysisEngines.set('security', {
      name: 'Security Analysis',
      patterns: {
        sqlInjection: [/\bquery\([^)]*\+/g, /\bexecute\([^)]*\+/g],
        xss: [/\bdangerouslySetInnerHTML\b/g, /\binnerHTML\b/g],
        auth: [/\bauth\b/g, /\btoken\b/g, /\bsession\b/g],
        crypto: [/\bcrypt\b/g, /\bcrypto\b/g, /\bhash\b/g],
        inputValidation: [/\bsanitize\b/g, /\bvalidate\b/g, /\bescape\b/g]
      },
      calculateScore: (matches) => {
        let score = 100;
        score -= matches.sqlInjection.length * 20;
        score -= matches.xss.length * 15;
        score += matches.auth.length * 5;
        score += matches.crypto.length * 10;
        score += matches.inputValidation.length * 8;
        return Math.max(0, Math.min(100, score));
      }
    });

    // Code Quality Analysis Engine
    this.analysisEngines.set('quality', {
      name: 'Code Quality Analysis',
      patterns: {
        errorHandling: [/\btry\b/g, /\bcatch\b/g, /\bthrow\b/g],
        comments: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g],
        functions: [/\bfunction\b/g, /\b=>\s*\{/g],
        complexity: [/\bif\b/g, /\belse\b/g, /\bswitch\b/g],
        testing: [/\bdescribe\b/g, /\bit\b/g, /\btest\b/g]
      },
      calculateScore: (matches) => {
        let score = 50; // Base score
        score += matches.errorHandling.length * 3;
        score += matches.comments.length * 2;
        score += matches.testing.length * 5;
        score -= matches.complexity.length * 1; // Penalize complexity
        return Math.max(0, Math.min(100, score));
      }
    });

    // Architecture Analysis Engine
    this.analysisEngines.set('architecture', {
      name: 'Architecture Analysis',
      patterns: {
        separation: [/\bcontroller\b/g, /\bservice\b/g, /\brepository\b/g],
        patterns: [/\bsingleton\b/g, /\bfactory\b/g, /\bobserver\b/g],
        layers: [/\broutes?\b/g, /\bmiddleware\b/g, /\bmodel\b/g],
        dependencies: [/\bimport\b/g, /\brequire\b/g, /\bfrom\b/g]
      },
      calculateScore: (matches) => {
        let score = 60; // Base score
        score += matches.separation.length * 5;
        score += matches.patterns.length * 8;
        score += matches.layers.length * 3;
        return Math.max(0, Math.min(100, score));
      }
    });
  }

  async analyzeCodebase(sourceDir, analysisTypes = ['performance', 'security', 'quality', 'architecture']) {
    console.log('🔍 AI analyzing codebase...');

    const analysis = {
      timestamp: new Date().toISOString(),
      directory: sourceDir,
      files: [],
      summary: {},
      insights: [],
      recommendations: [],
      metrics: {}
    };

    // Recursively scan directory
    const scanDirectory = async (dir, relativePath = '') => {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = join(relativePath, entry.name);

        if (entry.isDirectory()) {
          // Skip common non-source directories
          if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
            await scanDirectory(fullPath, relPath);
          }
        } else if (entry.isFile() && ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.mts'].includes(extname(entry.name))) {
          const fileAnalysis = await this.analyzeFile(fullPath, relPath, analysisTypes);
          if (fileAnalysis) {
            analysis.files.push(fileAnalysis);
          }
        }
      }
    };

    await scanDirectory(sourceDir);

    // Calculate summary metrics
    analysis.summary = this.calculateSummary(analysis.files, analysisTypes);
    analysis.insights = this.generateInsights(analysis.files, analysisTypes);
    analysis.recommendations = this.generateRecommendations(analysis.summary);
    analysis.metrics = this.calculateMetrics(analysis.files);

    this.insights.set(sourceDir, analysis);
    return analysis;
  }

  async analyzeFile(filePath, relativePath, analysisTypes) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = statSync(filePath);

      const fileAnalysis = {
        path: relativePath,
        size: stats.size,
        lines: content.split('\n').length,
        scores: {},
        issues: {},
        metrics: {}
      };

      // Run each analysis engine
      for (const type of analysisTypes) {
        const engine = this.analysisEngines.get(type);
        if (engine) {
          const matches = {};
          for (const [patternName, pattern] of Object.entries(engine.patterns)) {
            matches[patternName] = (content.match(pattern) || []).length;
          }

          fileAnalysis.scores[type] = engine.calculateScore(matches);
          fileAnalysis.issues[type] = this.identifyIssues(type, matches, content);
          fileAnalysis.metrics[type] = matches;
        }
      }

      return fileAnalysis;
    } catch (error) {
      console.warn(`⚠️ Could not analyze ${relativePath}:`, error.message);
      return null;
    }
  }

  identifyIssues(type, matches, content) {
    const issues = [];

    switch (type) {
      case 'performance':
        if (matches.blocking > 0) {
          issues.push({
            severity: 'high',
            message: 'Blocking I/O operations detected',
            suggestion: 'Use async/await or promises for non-blocking operations'
          });
        }
        if (matches.loops > 10) {
          issues.push({
            severity: 'medium',
            message: 'High loop count may impact performance',
            suggestion: 'Consider optimizing loops or using more efficient algorithms'
          });
        }
        break;

      case 'security':
        if (matches.sqlInjection > 0) {
          issues.push({
            severity: 'critical',
            message: 'Potential SQL injection vulnerability',
            suggestion: 'Use parameterized queries or prepared statements'
          });
        }
        if (matches.xss > 0) {
          issues.push({
            severity: 'high',
            message: 'Potential XSS vulnerability',
            suggestion: 'Sanitize user input and use safe DOM manipulation'
          });
        }
        break;

      case 'quality':
        if (matches.errorHandling === 0) {
          issues.push({
            severity: 'medium',
            message: 'No error handling detected',
            suggestion: 'Add try-catch blocks for error handling'
          });
        }
        if (matches.comments.length < matches.functions.length / 2) {
          issues.push({
            severity: 'low',
            message: 'Low comment density',
            suggestion: 'Add more comments to improve code documentation'
          });
        }
        break;
    }

    return issues;
  }

  calculateSummary(files, analysisTypes) {
    const summary = {};

    for (const type of analysisTypes) {
      const scores = files.map(f => f.scores[type]).filter(s => s !== undefined);
      if (scores.length > 0) {
        summary[type] = {
          average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          min: Math.min(...scores),
          max: Math.max(...scores),
          files: scores.length
        };
      }
    }

    return summary;
  }

  generateInsights(files, analysisTypes) {
    const insights = [];

    for (const type of analysisTypes) {
      const engine = this.analysisEngines.get(type);
      const summary = this.calculateSummary(files, [type])[type];

      if (summary) {
        let insight = {
          type,
          title: engine.name,
          score: summary.average,
          description: this.getInsightDescription(type, summary.average),
          trend: this.getScoreTrend(summary)
        };
        insights.push(insight);
      }
    }

    return insights;
  }

  getInsightDescription(type, score) {
    const descriptions = {
      performance: {
        high: 'Excellent performance patterns with good async usage',
        medium: 'Moderate performance with some optimization opportunities',
        low: 'Performance issues detected, significant improvements needed'
      },
      security: {
        high: 'Strong security practices implemented',
        medium: 'Adequate security with some vulnerabilities to address',
        low: 'Critical security issues require immediate attention'
      },
      quality: {
        high: 'High code quality with good practices',
        medium: 'Acceptable code quality with room for improvement',
        low: 'Code quality issues need significant refactoring'
      },
      architecture: {
        high: 'Well-structured architecture following best practices',
        medium: 'Reasonable architecture with some improvements possible',
        low: 'Architecture needs major restructuring'
      }
    };

    const category = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
    return descriptions[type][category];
  }

  getScoreTrend(summary) {
    const variance = summary.max - summary.min;
    if (variance < 10) return 'consistent';
    if (variance < 20) return 'variable';
    return 'inconsistent';
  }

  generateRecommendations(summary) {
    const recommendations = [];

    for (const [type, data] of Object.entries(summary)) {
      if (data.average < 70) {
        recommendations.push({
          type,
          priority: data.average < 50 ? 'high' : 'medium',
          title: `Improve ${type} score`,
          description: this.getRecommendationDescription(type, data.average),
          actions: this.getRecommendedActions(type)
        });
      }
    }

    // Sort by priority
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return recommendations;
  }

  getRecommendationDescription(type, score) {
    const descriptions = {
      performance: 'Focus on eliminating blocking operations and optimizing async patterns',
      security: 'Address security vulnerabilities and implement proper input validation',
      quality: 'Improve error handling, add documentation, and refactor complex code',
      architecture: 'Restructure code with better separation of concerns and design patterns'
    };
    return descriptions[type];
  }

  getRecommendedActions(type) {
    const actions = {
      performance: [
        'Replace synchronous I/O with async operations',
        'Implement caching for frequently accessed data',
        'Optimize loops and algorithms',
        'Use streaming for large data processing'
      ],
      security: [
        'Implement input validation and sanitization',
        'Use parameterized queries for database operations',
        'Add authentication and authorization',
        'Implement HTTPS and security headers'
      ],
      quality: [
        'Add comprehensive error handling',
        'Write unit and integration tests',
        'Add code documentation and comments',
        'Refactor complex functions into smaller ones'
      ],
      architecture: [
        'Implement proper separation of concerns',
        'Use design patterns appropriately',
        'Create clear abstraction layers',
        'Establish consistent coding conventions'
      ]
    };
    return actions[type];
  }

  calculateMetrics(files) {
    const metrics = {
      totalFiles: files.length,
      totalLines: files.reduce((sum, f) => sum + f.lines, 0),
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      averageFileSize: 0,
      averageLinesPerFile: 0,
      largestFile: null,
      smallestFile: null
    };

    if (files.length > 0) {
      metrics.averageFileSize = Math.round(metrics.totalSize / files.length);
      metrics.averageLinesPerFile = Math.round(metrics.totalLines / files.length);

      const sortedBySize = files.sort((a, b) => b.size - a.size);
      metrics.largestFile = sortedBySize[0].path;
      metrics.smallestFile = sortedBySize[sortedBySize.length - 1].path;
    }

    return metrics;
  }

  async generateReport(analysis, outputPath) {
    const report = `# AI Code Analysis Report

Generated: ${analysis.timestamp}
Directory: ${analysis.directory}

## 📊 Summary Metrics

- **Total Files**: ${analysis.metrics.totalFiles}
- **Total Lines**: ${analysis.metrics.totalLines.toLocaleString()}
- **Total Size**: ${(analysis.metrics.totalSize / 1024).toFixed(2)} KB
- **Average File Size**: ${(analysis.metrics.averageFileSize / 1024).toFixed(2)} KB
- **Average Lines/File**: ${analysis.metrics.averageLinesPerFile}
- **Largest File**: ${analysis.metrics.largestFile}
- **Smallest File**: ${analysis.metrics.smallestFile}

## 🎯 Analysis Scores

${Object.entries(analysis.summary).map(([type, data]) =>
  `### ${type.charAt(0).toUpperCase() + type.slice(1)}
- **Average Score**: ${data.average}/100
- **Range**: ${data.min} - ${data.max}
- **Files Analyzed**: ${data.files}`
).join('\n\n')}

## 💡 Key Insights

${analysis.insights.map(insight =>
  `### ${insight.title}
**Score**: ${insight.score}/100 - ${insight.description}
**Trend**: ${insight.trend.charAt(0).toUpperCase() + insight.trend.slice(1)}`
).join('\n\n')}

## 🚀 Recommendations

${analysis.recommendations.map((rec, index) =>
  `### ${index + 1}. ${rec.title} (${rec.priority.toUpperCase()} PRIORITY)
${rec.description}

**Suggested Actions:**
${rec.actions.map(action => `- ${action}`).join('\n')}`
).join('\n\n')}

## 📁 File Details

${analysis.files.map(file => {
  const scores = Object.entries(file.scores).map(([type, score]) => `${type}: ${score}`).join(', ');
  return `### ${file.path}
- **Size**: ${(file.size / 1024).toFixed(2)} KB
- **Lines**: ${file.lines}
- **Scores**: ${scores}`;
}).join('\n\n')}

---
*Report generated by OpenSpeed AI Code Analyzer*
`;

    await fs.writeFile(outputPath, report, 'utf-8');
    console.log(`📄 Analysis report saved to: ${outputPath}`);
  }
}

export function analyzeCommand() {
  const cmd = new Command('analyze')
    .description('🔍 AI-powered code analysis and insights')
    .argument('[source]', 'Source directory to analyze')
    .option('-t, --types <types>', 'Analysis types (comma-separated)', 'performance,security,quality,architecture')
    .option('-o, --output <file>', 'Output report file', 'analysis-report.md')
    .option('-f, --format <format>', 'Output format', 'markdown')
    .option('-d, --detailed', 'Include detailed file analysis')
    .option('-j, --json', 'Output in JSON format')
    .action(async (source, options) => {
      try {
        const analyzer = new AICodeAnalyzer();

        const sourceDir = source || process.cwd();
        const analysisTypes = options.types.split(',').map(t => t.trim());
        const outputPath = options.output;

        if (!existsSync(sourceDir)) {
          console.error(`❌ Source directory does not exist: ${sourceDir}`);
          process.exit(1);
        }

        console.log('🚀 OpenSpeed AI Code Analyzer');
        console.log('=============================');

        // Perform analysis
        console.log(`\n🔍 Analyzing ${sourceDir}...`);
        const analysis = await analyzer.analyzeCodebase(sourceDir, analysisTypes);

        // Display summary
        console.log('\n📊 Analysis Summary:');
        console.log(`Files Analyzed: ${analysis.metrics.totalFiles}`);
        console.log(`Total Lines: ${analysis.metrics.totalLines.toLocaleString()}`);

        console.log('\n🎯 Scores:');
        for (const [type, data] of Object.entries(analysis.summary)) {
          console.log(`${type.charAt(0).toUpperCase() + type.slice(1)}: ${data.average}/100`);
        }

        if (analysis.insights.length > 0) {
          console.log('\n💡 Key Insights:');
          analysis.insights.forEach(insight => {
            console.log(`• ${insight.title}: ${insight.score}/100 - ${insight.description}`);
          });
        }

        if (analysis.recommendations.length > 0) {
          console.log('\n🚀 Top Recommendations:');
          analysis.recommendations.slice(0, 3).forEach((rec, index) => {
            console.log(`${index + 1}. ${rec.title} (${rec.priority.toUpperCase()}): ${rec.description}`);
          });
        }

        // Generate report
        if (options.json) {
          await fs.writeFile(outputPath.replace('.md', '.json'), JSON.stringify(analysis, null, 2), 'utf-8');
          console.log(`📄 JSON report saved to: ${outputPath.replace('.md', '.json')}`);
        } else {
          await analyzer.generateReport(analysis, outputPath);
        }

        // Detailed output if requested
        if (options.detailed) {
          console.log('\n📁 File Details:');
          analysis.files.forEach(file => {
            const scores = Object.entries(file.scores).map(([type, score]) => `${type}: ${score}`).join(', ');
            console.log(`• ${file.path}: ${scores}`);
          });
        }

      } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}
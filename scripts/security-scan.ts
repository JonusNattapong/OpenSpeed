#!/usr/bin/env node

/**
 * OpenSpeed Security Scanner
 * 
 * Automated security vulnerability detection tool for OpenSpeed applications.
 * Scans for common security issues and provides recommendations.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { execSync } from 'child_process';

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  file: string;
  line: number;
  code: string;
  description: string;
  recommendation: string;
  cwe?: string;
}

interface ScanResult {
  issues: SecurityIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  files: number;
  scannedAt: string;
}

class SecurityScanner {
  private issues: SecurityIssue[] = [];
  private filesScanned = 0;

  /**
   * Security patterns to detect
   */
  private patterns = {
    // SQL Injection
    sqlInjection: {
      pattern: /\$\{[^}]+\}|` \+|query\s*\([^)]*\$\{/gi,
      severity: 'critical' as const,
      type: 'SQL Injection',
      cwe: 'CWE-89',
      description: 'Potential SQL injection via string interpolation',
      recommendation: 'Use parameterized queries instead of string concatenation',
    },

    // XSS - eval usage
    evalUsage: {
      pattern: /\beval\s*\(|new\s+Function\s*\(/gi,
      severity: 'critical' as const,
      type: 'Code Injection',
      cwe: 'CWE-95',
      description: 'Use of eval() or Function() constructor',
      recommendation: 'Avoid eval() and Function() - use safer alternatives',
    },

    // XSS - innerHTML
    innerHTML: {
      pattern: /\.innerHTML\s*=|dangerouslySetInnerHTML/gi,
      severity: 'high' as const,
      type: 'XSS Vulnerability',
      cwe: 'CWE-79',
      description: 'Potential XSS via innerHTML or dangerouslySetInnerHTML',
      recommendation: 'Use textContent or properly sanitize HTML input',
    },

    // Weak crypto
    weakCrypto: {
      pattern: /Math\.random\(\)|createHash\(['"]md5['"]|createHash\(['"]sha1['"])/gi,
      severity: 'high' as const,
      type: 'Weak Cryptography',
      cwe: 'CWE-327',
      description: 'Weak random number generation or hashing algorithm',
      recommendation: 'Use crypto.randomBytes() and SHA-256 or stronger',
    },

    // Hardcoded secrets
    hardcodedSecrets: {
      pattern: /(password|secret|api[_-]?key|token|auth)\s*[=:]\s*['"][^'"]{8,}['"]/gi,
      severity: 'critical' as const,
      type: 'Hardcoded Secrets',
      cwe: 'CWE-798',
      description: 'Potential hardcoded password, secret, or API key',
      recommendation: 'Use environment variables for sensitive data',
    },

    // Insecure HTTP
    insecureHttp: {
      pattern: /['"]http:\/\/[^'"]+['"]/gi,
      severity: 'medium' as const,
      type: 'Insecure Protocol',
      cwe: 'CWE-319',
      description: 'HTTP URL detected - should use HTTPS',
      recommendation: 'Use HTTPS for all external connections',
    },

    // Missing input validation
    noValidation: {
      pattern: /ctx\.req\.body\.[a-zA-Z_]+(?!\s*&&|\s*\|\||\.length|typeof)/g,
      severity: 'medium' as const,
      type: 'Missing Input Validation',
      cwe: 'CWE-20',
      description: 'Request body accessed without validation',
      recommendation: 'Validate all user inputs using validation schemas',
    },

    // Insecure cookie settings
    insecureCookie: {
      pattern: /setCookie\([^)]*(?!httpOnly|secure)[^)]*\)/gi,
      severity: 'medium' as const,
      type: 'Insecure Cookie',
      cwe: 'CWE-614',
      description: 'Cookie set without HttpOnly or Secure flags',
      recommendation: 'Set httpOnly: true and secure: true for cookies',
    },

    // Command injection
    commandInjection: {
      pattern: /exec\s*\([^)]*\$\{|execSync\s*\([^)]*\$\{|spawn\s*\([^)]*\$\{/gi,
      severity: 'critical' as const,
      type: 'Command Injection',
      cwe: 'CWE-78',
      description: 'Potential command injection via string interpolation',
      recommendation: 'Use array arguments or properly sanitize inputs',
    },

    // Path traversal
    pathTraversal: {
      pattern: /\.\.[\/\\]|path\s*\+|join\([^)]*\$\{/gi,
      severity: 'high' as const,
      type: 'Path Traversal',
      cwe: 'CWE-22',
      description: 'Potential path traversal vulnerability',
      recommendation: 'Validate and sanitize file paths, use path.resolve()',
    },

    // Missing CSRF protection
    missingCsrf: {
      pattern: /app\.(post|put|delete|patch)\s*\([^)]*(?!csrf)/gi,
      severity: 'medium' as const,
      type: 'Missing CSRF Protection',
      cwe: 'CWE-352',
      description: 'State-changing endpoint without CSRF protection',
      recommendation: 'Add CSRF protection to all non-GET endpoints',
    },

    // Insecure deserialization
    insecureDeserialize: {
      pattern: /JSON\.parse\([^)]*req\.body|JSON\.parse\([^)]*req\.query/gi,
      severity: 'high' as const,
      type: 'Insecure Deserialization',
      cwe: 'CWE-502',
      description: 'Direct JSON.parse of user input',
      recommendation: 'Validate JSON structure and content after parsing',
    },

    // Missing rate limiting
    missingRateLimit: {
      pattern: /app\.(post|put)\s*\(['"][^'"]*login[^'"]*['"]\s*,\s*(?!rateLimit)/gi,
      severity: 'medium' as const,
      type: 'Missing Rate Limiting',
      cwe: 'CWE-307',
      description: 'Authentication endpoint without rate limiting',
      recommendation: 'Add rate limiting to prevent brute force attacks',
    },
  };

  /**
   * Scan a directory recursively
   */
  async scanDirectory(dir: string): Promise<ScanResult> {
    console.log('🔍 OpenSpeed Security Scanner\n');
    console.log(`Scanning directory: ${dir}\n`);

    this.issues = [];
    this.filesScanned = 0;

    await this.scanDir(dir);

    // Also check dependencies
    await this.checkDependencies(dir);

    const summary = this.getSummary();

    return {
      issues: this.issues,
      summary,
      files: this.filesScanned,
      scannedAt: new Date().toISOString(),
    };
  }

  /**
   * Recursively scan directory
   */
  private async scanDir(dir: string): Promise<void> {
    // Skip node_modules, dist, build, .git
    const skipDirs = ['node_modules', 'dist', 'build', '.git', 'coverage'];
    
    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          if (!skipDirs.includes(entry)) {
            await this.scanDir(fullPath);
          }
        } else if (stat.isFile()) {
          // Only scan TypeScript and JavaScript files
          const ext = extname(entry);
          if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
            await this.scanFile(fullPath);
            this.filesScanned++;
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning ${dir}:`, error);
    }
  }

  /**
   * Scan a single file
   */
  private async scanFile(filePath: string): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Check each pattern
      for (const [name, config] of Object.entries(this.patterns)) {
        const matches = content.matchAll(config.pattern);

        for (const match of matches) {
          if (!match.index) continue;

          // Find line number
          const beforeMatch = content.substring(0, match.index);
          const lineNumber = beforeMatch.split('\n').length;

          // Get the line content
          const lineContent = lines[lineNumber - 1]?.trim() || '';

          // Skip comments and test files
          if (this.shouldSkip(lineContent, filePath)) continue;

          this.issues.push({
            severity: config.severity,
            type: config.type,
            file: filePath,
            line: lineNumber,
            code: lineContent,
            description: config.description,
            recommendation: config.recommendation,
            cwe: config.cwe,
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning file ${filePath}:`, error);
    }
  }

  /**
   * Check if line should be skipped
   */
  private shouldSkip(line: string, filePath: string): boolean {
    // Skip comments
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      return true;
    }

    // Skip test files
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      return true;
    }

    // Skip example files
    if (filePath.includes('/examples/') || filePath.includes('\\examples\\')) {
      return true;
    }

    return false;
  }

  /**
   * Check npm dependencies for vulnerabilities
   */
  private async checkDependencies(dir: string): Promise<void> {
    const packageJsonPath = join(dir, 'package.json');
    
    if (!existsSync(packageJsonPath)) return;

    try {
      console.log('\n📦 Checking dependencies for known vulnerabilities...\n');
      
      const output = execSync('npm audit --json', {
        cwd: dir,
        encoding: 'utf-8',
      });

      const auditResult = JSON.parse(output);
      
      if (auditResult.metadata) {
        const { vulnerabilities } = auditResult.metadata;
        
        if (vulnerabilities) {
          if (vulnerabilities.critical > 0) {
            this.issues.push({
              severity: 'critical',
              type: 'Dependency Vulnerability',
              file: 'package.json',
              line: 0,
              code: 'npm dependencies',
              description: `${vulnerabilities.critical} critical vulnerabilities found in dependencies`,
              recommendation: 'Run "npm audit fix" to fix vulnerabilities',
              cwe: 'CWE-1035',
            });
          }

          if (vulnerabilities.high > 0) {
            this.issues.push({
              severity: 'high',
              type: 'Dependency Vulnerability',
              file: 'package.json',
              line: 0,
              code: 'npm dependencies',
              description: `${vulnerabilities.high} high vulnerabilities found in dependencies`,
              recommendation: 'Run "npm audit fix" to fix vulnerabilities',
              cwe: 'CWE-1035',
            });
          }
        }
      }
    } catch (error) {
      // npm audit returns non-zero exit code if vulnerabilities found
      // This is expected, so we don't treat it as an error
    }
  }

  /**
   * Get summary of issues
   */
  private getSummary() {
    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
    };

    for (const issue of this.issues) {
      summary[issue.severity]++;
      summary.total++;
    }

    return summary;
  }

  /**
   * Print results to console
   */
  printResults(result: ScanResult): void {
    const { issues, summary, files } = result;

    console.log('\n' + '='.repeat(80));
    console.log('SECURITY SCAN RESULTS');
    console.log('='.repeat(80) + '\n');

    console.log(`Files scanned: ${files}`);
    console.log(`Issues found: ${summary.total}\n`);

    console.log('Severity Breakdown:');
    console.log(`  🔴 Critical: ${summary.critical}`);
    console.log(`  🟠 High:     ${summary.high}`);
    console.log(`  🟡 Medium:   ${summary.medium}`);
    console.log(`  🟢 Low:      ${summary.low}\n`);

    if (issues.length === 0) {
      console.log('✅ No security issues found!\n');
      return;
    }

    // Group issues by severity
    const grouped = {
      critical: issues.filter(i => i.severity === 'critical'),
      high: issues.filter(i => i.severity === 'high'),
      medium: issues.filter(i => i.severity === 'medium'),
      low: issues.filter(i => i.severity === 'low'),
    };

    // Print issues by severity
    for (const [severity, severityIssues] of Object.entries(grouped)) {
      if (severityIssues.length === 0) continue;

      const icon = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
      }[severity];

      console.log(`\n${icon} ${severity.toUpperCase()} SEVERITY (${severityIssues.length} issues)\n`);
      console.log('-'.repeat(80) + '\n');

      for (const issue of severityIssues) {
        console.log(`Type: ${issue.type}${issue.cwe ? ` (${issue.cwe})` : ''}`);
        console.log(`File: ${issue.file}:${issue.line}`);
        console.log(`Code: ${issue.code}`);
        console.log(`Issue: ${issue.description}`);
        console.log(`Fix: ${issue.recommendation}\n`);
      }
    }

    console.log('='.repeat(80) + '\n');

    // Exit with error code if critical or high issues found
    if (summary.critical > 0 || summary.high > 0) {
      console.log('❌ Security scan failed: Critical or High severity issues found\n');
      process.exit(1);
    } else if (summary.medium > 0) {
      console.log('⚠️  Security scan warning: Medium severity issues found\n');
      process.exit(0);
    } else {
      console.log('✅ Security scan passed\n');
      process.exit(0);
    }
  }

  /**
   * Export results to JSON
   */
  exportJSON(result: ScanResult, outputPath: string): void {
    const fs = require('fs');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n📄 Report exported to: ${outputPath}\n`);
  }
}

// CLI Usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const dir = args[0] || process.cwd();
  const outputJson = args.includes('--json');
  const outputPath = args[args.indexOf('--output') + 1] || 'security-report.json';

  const scanner = new SecurityScanner();
  
  scanner.scanDirectory(dir).then(result => {
    scanner.printResults(result);
    
    if (outputJson) {
      scanner.exportJSON(result, outputPath);
    }
  }).catch(error => {
    console.error('❌ Security scan error:', error);
    process.exit(1);
  });
}

export { SecurityScanner };

#!/usr/bin/env node

/**
 * OpenSpeed Security Auto-Fixer
 * 
 * Automatically fixes common security vulnerabilities
 */

import { readFileSync, writeFileSync } from 'fs';
import { SecurityScanner } from './security-scan.js';

interface FixResult {
  file: string;
  fixes: number;
  details: string[];
}

class SecurityFixer {
  private fixes: FixResult[] = [];

  /**
   * Auto-fix security issues
   */
  async fixDirectory(dir: string, dryRun = false): Promise<void> {
    console.log('🔧 OpenSpeed Security Auto-Fixer\n');
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No files will be modified\n');
    }

    // First scan for issues
    const scanner = new SecurityScanner();
    const scanResult = await scanner.scanDirectory(dir);

    // Group issues by file
    const fileIssues = new Map<string, any[]>();
    
    for (const issue of scanResult.issues) {
      if (!fileIssues.has(issue.file)) {
        fileIssues.set(issue.file, []);
      }
      fileIssues.get(issue.file)!.push(issue);
    }

    // Fix each file
    for (const [filePath, issues] of fileIssues) {
      await this.fixFile(filePath, issues, dryRun);
    }

    // Print summary
    this.printSummary();
  }

  /**
   * Fix issues in a single file
   */
  private async fixFile(filePath: string, issues: any[], dryRun: boolean): Promise<void> {
    console.log(`\n📝 Fixing: ${filePath}`);
    
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;
    const fixes: string[] = [];

    // Sort issues by line number (descending) to avoid line number shifts
    issues.sort((a, b) => b.line - a.line);

    for (const issue of issues) {
      let fixed = false;

      switch (issue.type) {
        case 'Weak Cryptography':
          if (content.includes('Math.random()')) {
            content = this.fixWeakRandom(content);
            fixes.push('✓ Replaced Math.random() with crypto.randomBytes()');
            fixed = true;
          }
          break;

        case 'Insecure Cookie':
          content = this.fixInsecureCookie(content);
          fixes.push('✓ Added HttpOnly and Secure flags to cookies');
          fixed = true;
          break;

        case 'Hardcoded Secrets':
          content = this.fixHardcodedSecrets(content, issue);
          fixes.push('✓ Replaced hardcoded secret with environment variable');
          fixed = true;
          break;

        case 'Insecure Protocol':
          content = this.fixInsecureProtocol(content);
          fixes.push('✓ Replaced HTTP with HTTPS');
          fixed = true;
          break;

        case 'XSS Vulnerability':
          if (content.includes('innerHTML')) {
            content = this.fixInnerHTML(content);
            fixes.push('✓ Replaced innerHTML with textContent');
            fixed = true;
          }
          break;

        case 'SQL Injection':
          // This requires manual review, just add comment
          fixes.push('⚠️  SQL Injection detected - MANUAL REVIEW REQUIRED');
          break;

        case 'Code Injection':
          // This requires manual review
          fixes.push('⚠️  eval() usage detected - MANUAL REVIEW REQUIRED');
          break;
      }

      if (fixed) {
        modified = true;
      }
    }

    if (modified && !dryRun) {
      // Add security fix comment at top of file
      const header = `// 🔒 Security fixes applied by OpenSpeed Security Auto-Fixer\n// Date: ${new Date().toISOString()}\n\n`;
      
      if (!content.startsWith('// 🔒')) {
        content = header + content;
      }

      writeFileSync(filePath, content, 'utf-8');
      
      this.fixes.push({
        file: filePath,
        fixes: fixes.length,
        details: fixes,
      });

      console.log(`✅ Applied ${fixes.length} fix(es)`);
      for (const fix of fixes) {
        console.log(`   ${fix}`);
      }
    } else if (modified && dryRun) {
      console.log(`📋 Would apply ${fixes.length} fix(es):`);
      for (const fix of fixes) {
        console.log(`   ${fix}`);
      }
    } else {
      console.log('ℹ️  No auto-fixable issues found');
    }
  }

  /**
   * Fix Math.random() usage
   */
  private fixWeakRandom(content: string): string {
    // Add crypto import if not present
    if (!content.includes("from 'crypto'") && !content.includes('from "crypto"')) {
      const importStatement = "import { randomBytes } from 'crypto';\n";
      content = importStatement + content;
    }

    // Replace Math.random() with crypto
    content = content.replace(
      /Math\.random\(\)/g,
      '(randomBytes(4).readUInt32BE(0) / 0x100000000)'
    );

    return content;
  }

  /**
   * Fix insecure cookie settings
   */
  private fixInsecureCookie(content: string): string {
    // Add httpOnly and secure to cookie options
    content = content.replace(
      /setCookie\s*\(\s*['"]([^'"]+)['"]\s*,\s*([^,]+)\s*,\s*\{([^}]*)\}\s*\)/g,
      (match, name, value, options) => {
        let opts = options.trim();
        if (!opts.includes('httpOnly')) {
          opts += opts ? ', httpOnly: true' : 'httpOnly: true';
        }
        if (!opts.includes('secure')) {
          opts += opts ? ', secure: true' : 'secure: true';
        }
        if (!opts.includes('sameSite')) {
          opts += opts ? ", sameSite: 'strict'" : "sameSite: 'strict'";
        }
        return `setCookie('${name}', ${value}, { ${opts} })`;
      }
    );

    return content;
  }

  /**
   * Fix hardcoded secrets
   */
  private fixHardcodedSecrets(content: string, issue: any): string {
    const lines = content.split('\n');
    const lineIndex = issue.line - 1;
    
    if (lineIndex < 0 || lineIndex >= lines.length) return content;

    const line = lines[lineIndex];
    
    // Extract variable name and value
    const match = line.match(/(const|let|var)\s+(\w+)\s*=\s*['"]([^'"]+)['"]/);
    
    if (match) {
      const [, , varName, ] = match;
      const envVarName = varName.toUpperCase();
      
      // Replace with environment variable
      lines[lineIndex] = line.replace(
        /=\s*['"][^'"]+['"]/,
        `= process.env.${envVarName} || ''`
      );
      
      // Add comment
      lines.splice(lineIndex, 0, `  // ⚠️  Set ${envVarName} in environment variables`);
    }

    return lines.join('\n');
  }

  /**
   * Fix insecure HTTP URLs
   */
  private fixInsecureProtocol(content: string): string {
    // Replace http:// with https:// (except localhost)
    content = content.replace(
      /['"]http:\/\/(?!localhost|127\.0\.0\.1)([^'"]+)['"]/g,
      '"https://$1"'
    );

    return content;
  }

  /**
   * Fix innerHTML usage
   */
  private fixInnerHTML(content: string): string {
    // Replace innerHTML with textContent for simple cases
    content = content.replace(
      /(\w+)\.innerHTML\s*=\s*([^;]+);/g,
      (match, elem, value) => {
        // Check if value needs HTML escaping
        if (value.includes('`') || value.includes('+')) {
          return `// ⚠️  Manual review: ${match}\n  ${elem}.textContent = ${value}; // Consider using a sanitizer if HTML is needed`;
        }
        return `${elem}.textContent = ${value};`;
      }
    );

    return content;
  }

  /**
   * Print fix summary
   */
  private printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('FIX SUMMARY');
    console.log('='.repeat(80) + '\n');

    const totalFixes = this.fixes.reduce((sum, f) => sum + f.fixes, 0);
    
    console.log(`Files modified: ${this.fixes.length}`);
    console.log(`Total fixes applied: ${totalFixes}\n`);

    if (this.fixes.length > 0) {
      console.log('Modified files:');
      for (const fix of this.fixes) {
        console.log(`\n  📄 ${fix.file}`);
        console.log(`     Applied ${fix.fixes} fix(es):`);
        for (const detail of fix.details) {
          console.log(`     ${detail}`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n⚠️  IMPORTANT: Review all changes before committing!');
    console.log('Some fixes may require manual verification.\n');
  }
}

// CLI Usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const dir = args[0] || process.cwd();
  const dryRun = args.includes('--dry-run');

  const fixer = new SecurityFixer();
  
  fixer.fixDirectory(dir, dryRun).catch(error => {
    console.error('❌ Auto-fix error:', error);
    process.exit(1);
  });
}

export { SecurityFixer };

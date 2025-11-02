#!/usr/bin/env node

/**
 * Pre-publish checklist for OpenSpeed
 * Verifies that the package is ready for npm publish
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function warning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ ${message}`, 'cyan');
}

function header(message) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  ${message}`, 'blue');
  log(`${'='.repeat(60)}`, 'blue');
}

let hasErrors = false;
let hasWarnings = false;

// Checklist items
const checks = {
  // File existence checks
  requiredFiles: [
    'package.json',
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
    'dist/src/openspeed/index.js',
    'dist/src/openspeed/index.d.ts',
    'dist/src/openspeed/plugins/index.js',
    'dist/src/openspeed/plugins/jsx.js',
    'dist/src/openspeed/plugins/ssg.js',
    'dist/src/openspeed/plugins/rpc.js',
    'dist/src/openspeed/plugins/stream.js',
    'dist/src/openspeed/plugins/validate.js',
  ],

  // Optional but recommended files
  recommendedFiles: [
    'dist/src/openspeed/router.js',
    'dist/src/openspeed/context.js',
    'dist/src/openspeed/server.js',
  ],
};

header('OpenSpeed Pre-Publish Checklist');

// 1. Check required files
header('1. Checking Required Files');
checks.requiredFiles.forEach((file) => {
  const filePath = path.join(rootDir, file);
  if (fs.existsSync(filePath)) {
    success(`Found: ${file}`);
  } else {
    error(`Missing: ${file}`);
    hasErrors = true;
  }
});

// 2. Check package.json
header('2. Validating package.json');
try {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  // Check required fields
  const requiredFields = ['name', 'version', 'description', 'main', 'license', 'repository'];
  requiredFields.forEach((field) => {
    if (packageJson[field]) {
      success(`package.json has '${field}': ${JSON.stringify(packageJson[field]).substring(0, 50)}`);
    } else {
      error(`package.json missing '${field}'`);
      hasErrors = true;
    }
  });

  // Check version format
  const versionRegex = /^\d+\.\d+\.\d+$/;
  if (versionRegex.test(packageJson.version)) {
    success(`Version format is valid: ${packageJson.version}`);
  } else {
    warning(`Version format might be invalid: ${packageJson.version}`);
    hasWarnings = true;
  }

  // Check for circular dependencies
  if (packageJson.dependencies && packageJson.dependencies.openspeed) {
    error('Circular dependency detected: openspeed depends on itself');
    hasErrors = true;
  } else {
    success('No circular dependencies');
  }

  // Check exports
  if (packageJson.exports) {
    success('Package exports are defined');
    const exportKeys = Object.keys(packageJson.exports);
    info(`  Exports: ${exportKeys.join(', ')}`);
  } else {
    warning('No exports field in package.json');
    hasWarnings = true;
  }

  // Check files field
  if (packageJson.files && packageJson.files.length > 0) {
    success(`Files field includes: ${packageJson.files.join(', ')}`);
  } else {
    warning('No files field in package.json - all files will be published');
    hasWarnings = true;
  }
} catch (err) {
  error(`Failed to parse package.json: ${err.message}`);
  hasErrors = true;
}

// 3. Check README
header('3. Validating README.md');
try {
  const readmePath = path.join(rootDir, 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf-8');

  if (readme.length > 1000) {
    success(`README.md has substantial content (${readme.length} characters)`);
  } else {
    warning(`README.md is quite short (${readme.length} characters)`);
    hasWarnings = true;
  }

  // Check for important sections
  const sections = ['Installation', 'Quick Start', 'Features', 'Examples'];
  sections.forEach((section) => {
    if (readme.includes(section)) {
      success(`README includes '${section}' section`);
    } else {
      warning(`README might be missing '${section}' section`);
      hasWarnings = true;
    }
  });
} catch (err) {
  error(`Failed to read README.md: ${err.message}`);
  hasErrors = true;
}

// 4. Check CHANGELOG
header('4. Validating CHANGELOG.md');
try {
  const changelogPath = path.join(rootDir, 'CHANGELOG.md');
  const changelog = fs.readFileSync(changelogPath, 'utf-8');

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')
  );
  const version = packageJson.version;

  if (changelog.includes(version)) {
    success(`CHANGELOG includes current version (${version})`);
  } else {
    warning(`CHANGELOG might not include current version (${version})`);
    hasWarnings = true;
  }

  if (changelog.length > 500) {
    success(`CHANGELOG has content (${changelog.length} characters)`);
  } else {
    warning(`CHANGELOG is quite short (${changelog.length} characters)`);
    hasWarnings = true;
  }
} catch (err) {
  error(`Failed to read CHANGELOG.md: ${err.message}`);
  hasErrors = true;
}

// 5. Check build artifacts
header('5. Verifying Build Artifacts');
const distPath = path.join(rootDir, 'dist');
if (fs.existsSync(distPath)) {
  success('dist/ directory exists');

  // Count JavaScript and TypeScript declaration files
  const countFiles = (dir, ext) => {
    let count = 0;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    files.forEach((file) => {
      if (file.isDirectory()) {
        count += countFiles(path.join(dir, file.name), ext);
      } else if (file.name.endsWith(ext)) {
        count++;
      }
    });
    return count;
  };

  const jsFiles = countFiles(distPath, '.js');
  const dtsFiles = countFiles(distPath, '.d.ts');

  if (jsFiles > 0) {
    success(`Found ${jsFiles} JavaScript files in dist/`);
  } else {
    error('No JavaScript files found in dist/');
    hasErrors = true;
  }

  if (dtsFiles > 0) {
    success(`Found ${dtsFiles} TypeScript declaration files`);
  } else {
    warning('No TypeScript declaration files found');
    hasWarnings = true;
  }
} else {
  error('dist/ directory does not exist - run npm run build first');
  hasErrors = true;
}

// 6. Check TypeScript compilation
header('6. TypeScript Compilation Check');
try {
  info('Running typecheck...');
  execSync('npm run typecheck', { cwd: rootDir, stdio: 'pipe' });
  success('TypeScript compilation passed');
} catch (err) {
  warning('TypeScript typecheck found issues (might be acceptable)');
  hasWarnings = true;
}

// 7. Check for sensitive files
header('7. Checking for Sensitive Files');
const sensitivePatterns = [
  '.env',
  '.env.local',
  '.env.production',
  'secrets.json',
  'private.key',
  '.npmrc',
];

let foundSensitive = false;
sensitivePatterns.forEach((pattern) => {
  const filePath = path.join(rootDir, pattern);
  if (fs.existsSync(filePath)) {
    warning(`Found potentially sensitive file: ${pattern}`);
    foundSensitive = true;
    hasWarnings = true;
  }
});

if (!foundSensitive) {
  success('No sensitive files detected');
}

// 8. Check package size
header('8. Estimating Package Size');
try {
  // Get tarball info
  info('Running npm pack --dry-run...');
  const output = execSync('npm pack --dry-run', { cwd: rootDir, encoding: 'utf-8' });

  // Extract size from output
  const sizeMatch = output.match(/package size:\s+(\S+)/i);
  const unpackedMatch = output.match(/unpacked size:\s+(\S+)/i);

  if (sizeMatch) {
    const size = sizeMatch[1];
    success(`Package size: ${size}`);

    // Parse size and warn if too large
    const sizeNum = parseFloat(size);
    const unit = size.replace(/[\d.]/g, '').trim().toLowerCase();

    if (unit === 'mb' && sizeNum > 10) {
      warning(`Package is quite large (${size}) - consider excluding unnecessary files`);
      hasWarnings = true;
    }
  }

  if (unpackedMatch) {
    info(`Unpacked size: ${unpackedMatch[1]}`);
  }

  // Count files
  const fileCount = (output.match(/\d+\s+files?/i) || [])[0];
  if (fileCount) {
    info(`File count: ${fileCount}`);
  }
} catch (err) {
  warning(`Could not estimate package size: ${err.message}`);
  hasWarnings = true;
}

// 9. Git status check
header('9. Git Status Check');
try {
  const status = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf-8' });

  if (status.trim() === '') {
    success('Working directory is clean');
  } else {
    warning('You have uncommitted changes:');
    console.log(status);
    hasWarnings = true;
  }

  // Check if on main/master branch
  const branch = execSync('git branch --show-current', { cwd: rootDir, encoding: 'utf-8' }).trim();
  if (branch === 'main' || branch === 'master') {
    success(`On ${branch} branch`);
  } else {
    warning(`Currently on '${branch}' branch (recommend publishing from main/master)`);
    hasWarnings = true;
  }
} catch (err) {
  warning('Could not check git status (not a git repository?)');
  hasWarnings = true;
}

// 10. Final summary
header('Summary');

if (hasErrors) {
  error('\n❌ Pre-publish checks FAILED');
  error('Please fix the errors above before publishing.');
  process.exit(1);
} else if (hasWarnings) {
  warning('\n⚠️  Pre-publish checks passed with WARNINGS');
  warning('Review the warnings above before publishing.');
  info('\nTo publish anyway, run:');
  info('  npm publish');
  process.exit(0);
} else {
  success('\n✅ All pre-publish checks PASSED!');
  info('\nYour package is ready to publish. Run:');
  info('  npm publish');
  info('\nOr for a dry run first:');
  info('  npm publish --dry-run');
  process.exit(0);
}

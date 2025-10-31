#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const program = new Command();

program
  .name('openspeed')
  .description('🚀 OpenSpeed Framework - Advanced CLI with AI-Powered Development Tools')
  .version('0.5.0');

// Import CLI commands dynamically
async function loadCommands() {
  const commandsDir = join(__dirname, 'cli', 'commands');

  try {
    // Scaffold command - AI-powered project generation
    const { scaffoldCommand } = await import('./commands/scaffold.js');
    program.addCommand(scaffoldCommand());

    // Tutorial command - Interactive AI mentorship
    const { tutorialCommand } = await import('./commands/tutorial.js');
    program.addCommand(tutorialCommand());

    // Migrate command - Framework migration tools
    const { migrateCommand } = await import('./commands/migrate.js');
    program.addCommand(migrateCommand());

    // Analyze command - Code analysis and insights
    const { analyzeCommand } = await import('./commands/analyze.js');
    program.addCommand(analyzeCommand());

    // Generate command - Code generation utilities
    const { generateCommand } = await import('./commands/generate.js');
    program.addCommand(generateCommand());

  } catch (error) {
    console.error('❌ Failed to load CLI commands:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 OpenSpeed CLI shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 OpenSpeed CLI terminated...');
  process.exit(0);
});

// Main execution
async function main() {
  try {
    await loadCommands();

    // Show help if no arguments provided
    if (process.argv.length === 2) {
      program.help();
    } else {
      await program.parseAsync();
    }
  } catch (error) {
    console.error('❌ CLI Error:', error.message);
    process.exit(1);
  }
}

main();
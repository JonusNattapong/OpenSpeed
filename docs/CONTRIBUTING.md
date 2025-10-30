# Contributing to OpenSpeed

Thank you for your interest in contributing to OpenSpeed! We welcome contributions from the community.

## Ways to Contribute

- **🐛 Bug Reports**: Report bugs and issues
- **✨ Feature Requests**: Suggest new features
- **📖 Documentation**: Improve documentation and examples
- **🔧 Code**: Submit pull requests with fixes or features
- **🧪 Tests**: Add or improve test coverage
- **📦 Plugins**: Create new plugins for the ecosystem

## Development Setup

### Prerequisites

- Node.js 18+ or Bun 1.0+
- npm or yarn or pnpm

### Clone and Setup

```bash
git clone https://github.com/JonusNattapong/OpenSpeed.git
cd OpenSpeed
npm install
```

### Development Workflow

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build the project
npm run build

# Run development server with examples
npm run dev

# Run benchmarks
npm run benchmark
```

## Code Style

We use ESLint and Prettier for code formatting. The project includes pre-configured settings:

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### TypeScript Guidelines

- Use strict TypeScript settings
- Provide type definitions for all public APIs
- Use interfaces for object shapes
- Use generics for reusable components
- Document complex types with JSDoc comments

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions/Methods**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Interfaces**: `PascalCase` with `I` prefix optional
- **Types**: `PascalCase`

## Submitting Changes

### 1. Create an Issue

Before making changes, create an issue to discuss the proposed changes:

- **Bug fixes**: Describe the bug and how to reproduce it
- **Features**: Explain the use case and implementation approach
- **Documentation**: Specify what needs to be documented

### 2. Fork and Branch

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/your-username/OpenSpeed.git
cd OpenSpeed

# Create a feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### 3. Make Changes

- Write clear, focused commits
- Include tests for new functionality
- Update documentation as needed
- Follow the existing code style

### 4. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/core/context.test.ts

# Test with different runtimes
npm run test:node
npm run test:bun
npm run test:deno
```

### 5. Submit Pull Request

```bash
# Push your branch
git push origin feature/your-feature-name

# Create a pull request on GitHub
```

### Pull Request Guidelines

- **Title**: Clear, descriptive title
- **Description**: Explain what changes and why
- **Tests**: Include tests for new features
- **Documentation**: Update docs for API changes
- **Breaking Changes**: Clearly mark breaking changes

## Plugin Development

### Creating a Plugin

Plugins should follow this structure:

```typescript
function myPlugin(options: MyPluginOptions = {}) {
  return (ctx: Context, next: () => Promise<any>) => {
    // Plugin logic here
    return next();
  };
}

export { myPlugin };
export type { MyPluginOptions };
```

### Plugin Requirements

- **TypeScript**: Full type safety
- **Documentation**: README with examples
- **Tests**: Comprehensive test coverage
- **Options**: Configurable via options object
- **Error Handling**: Proper error handling and HttpError usage

### Publishing a Plugin

```json
{
  "name": "openspeed-plugin-my-feature",
  "keywords": ["openspeed", "openspeed-plugin"],
  "peerDependencies": {
    "openspeed-framework": "^0.1.0"
  }
}
```

## Documentation

### Writing Documentation

- Use clear, concise language
- Include code examples for all features
- Document all options and parameters
- Explain common use cases and patterns

### Documentation Structure

```
docs/
├── api.md              # API reference
├── guides/             # Getting started guides
├── plugins/            # Plugin documentation
├── examples/           # Example explanations
└── CONTRIBUTING.md     # This file
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/openspeed/index.js';

describe('My Feature', () => {
  it('should work correctly', () => {
    const app = createApp();

    // Test implementation
    expect(result).toBe(expected);
  });
});
```

### Integration Tests

```typescript
describe('API Integration', () => {
  it('should handle requests end-to-end', async () => {
    const app = createApp();
    // ... setup routes ...

    const response = await makeRequest(app, 'GET', '/api/test');
    expect(response.status).toBe(200);
  });
});
```

### Performance Tests

```typescript
describe('Performance', () => {
  it('should handle many concurrent requests', async () => {
    const app = createApp();
    // ... setup ...

    const results = await benchmark(app, {
      connections: 100,
      duration: 10
    });

    expect(results.avgResponseTime).toBeLessThan(50);
  });
});
```

## Code Review Process

1. **Automated Checks**: CI runs tests, linting, and type checking
2. **Peer Review**: At least one maintainer reviews the code
3. **Discussion**: Address review comments and iterate
4. **Approval**: Maintainers approve and merge

## Release Process

- **Semantic Versioning**: We follow semver (MAJOR.MINOR.PATCH)
- **Changelog**: Update CHANGELOG.md for each release
- **Git Tags**: Tag releases with version numbers
- **GitHub Releases**: Create releases with release notes

## Community

- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Report bugs and request features
- **Discord**: Join our Discord for real-time chat
- **Twitter**: Follow for updates

## License

By contributing to OpenSpeed, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to OpenSpeed! 🎉
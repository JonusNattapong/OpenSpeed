---
layout: default
title: Installation
nav_order: 2
---

# Installation

OpenSpeed can be installed and used in multiple ways depending on your needs.

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm** or **yarn** or **pnpm**
- **TypeScript** (optional, for type checking)

## Option 1: Create a New Project

The easiest way to get started is to use the OpenSpeed CLI to create a new project:

```bash
npx create-openspeed-app my-app
cd my-app
npm install
npm run dev
```

This will create a new project with:
- Basic project structure
- Example routes and middleware
- Development server configuration
- TypeScript configuration

## Option 2: Add to Existing Project

If you have an existing Node.js project, you can add OpenSpeed as a dependency:

```bash
npm install openspeed-framework
# or
yarn add openspeed-framework
# or
pnpm add openspeed-framework
```

Then create your first server:

```typescript
// server.ts
import { createApp } from 'openspeed-framework';

const app = createApp();

app.get('/', (ctx) => {
  return ctx.text('Hello OpenSpeed!');
});

await app.listen(3000);
console.log('Server running on http://localhost:3000');
```

## Runtime Support

OpenSpeed supports multiple JavaScript runtimes:

### Node.js
```bash
node server.ts
```

### Bun
```bash
bun server.ts
```

## Next Steps

- [Quick Start Guide](quick-start.md) - Learn the basics
- [API Reference](api.md) - Complete API documentation
- [Examples](../examples/) - Working examples

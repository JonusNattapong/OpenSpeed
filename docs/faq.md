---
layout: default
title: FAQ
nav_order: 15
---

# Frequently Asked Questions

## General

### What is OpenSpeed?

OpenSpeed is a high-performance web framework for Node.js, designed for building APIs and web applications with excellent developer experience.

### How does OpenSpeed compare to other frameworks?

OpenSpeed offers:
- 2-3x better performance than Hono and Elysia
- Enterprise features like RBAC and audit logging
- ML-powered optimization
- Plugin-based architecture
- TypeScript-first design

### Is OpenSpeed production ready?

Yes, OpenSpeed is designed for production use with comprehensive testing, security features, and performance optimizations.

## Installation

### Which Node.js versions are supported?

OpenSpeed requires Node.js 18.0.0 or higher.

### Can I use OpenSpeed with TypeScript?

Yes, OpenSpeed is built with TypeScript and provides excellent type safety.

### Does OpenSpeed support other runtimes?

OpenSpeed supports Node.js, Bun, and Deno.

## Development

### How do I enable hot reload?

Use `npm run dev` for development with automatic restart.

### How do I debug my application?

Use standard Node.js debugging tools. OpenSpeed provides detailed error messages and logging.

### How do I handle errors?

Use the error handler plugin for centralized error management.

## Performance

### Why is OpenSpeed fast?

OpenSpeed uses advanced techniques like adaptive optimization, object pooling, and zero-copy streaming.

### How do I optimize my application?

- Enable the ML optimizer
- Use streaming for large files
- Implement caching
- Use connection pooling for databases

### What are the memory requirements?

OpenSpeed is memory efficient with object pooling and streaming. Typical applications use 80-120MB.

## Plugins

### How do I create custom plugins?

Plugins are middleware functions that extend the context. See the [Plugins documentation](plugins/) for examples.

### Are plugins compatible between versions?

We maintain backward compatibility for plugins within major versions.

### Can I use plugins from other frameworks?

OpenSpeed plugins are specific to the framework, but you can adapt concepts from other frameworks.

## Deployment

### How do I deploy to production?

Build with `npm run build` and run with `npm start`. Use PM2 or Docker for process management.

### Does OpenSpeed support Docker?

Yes, OpenSpeed includes Docker support with optimized images.

### How do I scale my application?

OpenSpeed supports horizontal scaling with load balancers and Kubernetes integration.

## Security

### Is OpenSpeed secure?

OpenSpeed includes security features like CSRF protection, input validation, and security headers.

### How do I handle authentication?

Use plugins for authentication or implement custom middleware.

### Does OpenSpeed prevent common vulnerabilities?

Yes, OpenSpeed includes protections against SQL injection, XSS, and other common attacks.

## Troubleshooting

### My routes are not matching

Check route patterns and parameter names. Use `app.printRoutes()` for debugging.

### I'm getting timeout errors

Check middleware performance and database connections. Enable the performance monitor.

### File uploads are failing

Ensure the upload plugin is enabled and check file size limits.

## Contributing

### How can I contribute?

See our [Contributing Guide](contributing/) for information on reporting issues and submitting pull requests.

### Where can I get help?

Check the documentation, GitHub issues, or join our community discussions.

### Can I sponsor the project?

Yes, sponsorships help support development. Contact us for more information.

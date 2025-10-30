# Changelog

All notable changes to OpenSpeed will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of OpenSpeed framework
- High-performance trie-based router with O(1) lookups
- Runtime-agnostic support (Node.js, Bun, Deno)
- Plugin architecture for extensibility
- TypeScript-first development experience

### Core Features
- **File Upload Plugin**: Multipart parsing with streaming support
- **WebSocket Plugin**: Real-time communication with room management
- **Cookie Plugin**: Session management with CookieJar implementation
- **Error Handler Plugin**: Comprehensive error management with typed exceptions
- **Context API**: Fluent response helpers (text, json, html, redirect)
- **Request Utilities**: Query params, route params, body parsing, user context

### Developer Experience
- Comprehensive API documentation
- Getting started guides and examples
- Plugin development documentation
- Contributing guidelines
- Automated testing with 22/22 tests passing

## [0.1.0] - 2025-10-30

### Added
- Initial framework implementation
- Basic routing and middleware system
- Context class with response helpers
- Trie-based router implementation
- Runtime detection and adapters
- Plugin system foundation
- Basic test suite

### Core Components
- `createApp()` factory function
- Route registration (GET, POST, PUT, DELETE, PATCH, OPTIONS)
- Middleware chaining
- Request/response context
- Route introspection and printing

### Development Tools
- TypeScript configuration
- Testing setup with Vitest
- Build system with tsc
- Basic CLI scaffolding tool
- Example applications

### Documentation
- Basic README with installation and usage
- API overview
- Development setup instructions

---

## Types of Changes

- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` in case of vulnerabilities

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

## Future Releases

### Planned for v0.2.0
- Authentication plugin (JWT, Basic, Bearer)
- Rate limiting plugin
- Static file serving plugin
- OpenAPI documentation generator
- Database integration helpers
- Performance optimizations
- Additional runtime support

### Planned for v0.3.0
- GraphQL support
- WebSocket subprotocols
- Advanced caching strategies
- Microservices toolkit
- Cloud platform integrations

### Planned for v1.0.0
- Stable API guarantees
- Production-ready optimizations
- Comprehensive plugin ecosystem
- Enterprise features
- Long-term support

---

For more information about upcoming features, see our [GitHub Issues](https://github.com/JonusNattapong/OpenSpeed/issues) and [Roadmap](https://github.com/JonusNattapong/OpenSpeed/discussions).
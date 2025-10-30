# OpenSpeed Examples

This directory contains complete, runnable examples demonstrating various OpenSpeed features and use cases.

## Getting Started Examples

### [Hello World](../../examples/hello-openspeed/)
The basic getting started example showing routing, middleware, and responses.

```bash
cd examples/hello-openspeed
npm install
npm run dev
```

Features demonstrated:
- Basic routing (`GET`, `POST`, `PUT`, `DELETE`)
- Response helpers (`text()`, `json()`, `html()`)
- Route parameters
- Query parameters
- Middleware usage

## Feature Examples

### [File Upload](../../examples/file-upload/)
Complete file upload implementation with validation and storage.

```bash
cd examples/file-upload
npm install
npm run dev
```

Features demonstrated:
- Single and multiple file uploads
- File validation (size, type)
- Streaming uploads
- Disk storage
- Error handling

### [WebSocket Chat](../../examples/websocket-chat/)
Real-time chat application with rooms and user management.

```bash
cd examples/websocket-chat
npm install
npm run dev
```

Features demonstrated:
- WebSocket connections
- Room-based messaging
- User authentication
- Connection management
- Real-time updates

### [API with Documentation](../../examples/api-with-docs/)
REST API with automatic OpenAPI documentation generation.

```bash
cd examples/api-with-docs
npm install
npm run dev
```

Features demonstrated:
- RESTful API design
- CRUD operations
- OpenAPI spec generation
- API documentation UI
- Request validation

## Advanced Examples

### Full-Stack Application
Complete application with authentication, database, and real-time features.

### Microservices
Example of building microservices with OpenSpeed.

### GraphQL API
GraphQL implementation with OpenSpeed.

## Running Examples

Each example is self-contained with its own `package.json`. To run an example:

1. Navigate to the example directory
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Open your browser to `http://localhost:3000`

## Example Structure

```
examples/
├── hello-openspeed/
│   ├── index.ts          # Main application
│   ├── package.json      # Dependencies
│   └── README.md         # Example documentation
├── file-upload/
│   ├── index.ts
│   ├── uploads/          # Upload directory
│   └── package.json
└── websocket-chat/
    ├── index.ts
    ├── public/           # Static files
    ├── package.json
    └── README.md
```

## Contributing Examples

We welcome contributions of new examples! When adding an example:

1. Create a new directory under `examples/`
2. Include a `package.json` with necessary dependencies
3. Add a `README.md` explaining the example
4. Keep examples focused on specific features
5. Include comments in the code explaining key concepts
6. Test that the example runs correctly

## Example Categories

- **Basic**: Simple routing and responses
- **Middleware**: Custom middleware examples
- **Plugins**: Showcasing specific plugins
- **Integration**: Database, authentication, etc.
- **Advanced**: Complex real-world applications
- **Performance**: Optimized implementations

See the [Contributing Guide](../CONTRIBUTING.md) for detailed guidelines.
# OpenSpeed Todo App Example

A beautiful, full-stack Todo application built with OpenSpeed, showcasing JSX templating, REST API, and modern web development practices.

## ✨ Features

- 🎨 **Modern UI**: Beautiful, responsive design with smooth animations
- ⚡ **Real-time Updates**: Instant UI updates without page refresh
- 🔄 **Full-Stack**: Frontend JSX + Backend REST API
- 📱 **Responsive**: Works perfectly on desktop and mobile
- 🎯 **Type-Safe**: Full TypeScript support
- 🚀 **Fast Development**: Hot reload and instant feedback

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start the development server:**
   ```bash
   pnpm run dev
   ```

3. **Open your browser:**
   ```
   http://localhost:3000
   ```

## What You'll Learn

### JSX Templating
OpenSpeed supports JSX out of the box, making it easy to build dynamic HTML:

```typescript
function TodoItem({ todo }) {
  return html`
    <li class="todo-item">
      <input type="checkbox" checked=${todo.completed} />
      <span>${todo.text}</span>
    </li>
  `;
}
```

### REST API Design
Clean, RESTful API endpoints with proper HTTP methods:

```typescript
// Get all todos
app.get('/api/todos', (ctx) => {
  return ctx.json({ success: true, data: todos });
});

// Create new todo
app.post('/api/todos', async (ctx) => {
  const { text } = await ctx.req.json();
  // ... create todo
  return ctx.json({ success: true, data: newTodo }, 201);
});
```

### Client-Server Communication
Modern fetch API with proper error handling:

```javascript
async handleAddTodo(event) {
  const response = await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  const result = await response.json();
  if (result.success) {
    // Update UI
  }
}
```

## Project Structure

```
src/
├── index.ts              # Main application server
└── public/               # Static assets
    ├── style.css         # Beautiful, modern CSS
    └── app.js           # Client-side JavaScript
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Main application page |
| GET | `/api/todos` | Get all todos |
| POST | `/api/todos` | Create new todo |
| PUT | `/api/todos/:id` | Update todo |
| DELETE | `/api/todos/:id` | Delete todo |
| GET | `/health` | Health check |

## Key Concepts Demonstrated

### 1. JSX Components
- Component-based architecture
- Props passing
- Template literals with embedded expressions

### 2. State Management
- In-memory state (easily replaceable with database)
- Optimistic UI updates
- Real-time synchronization

### 3. API Design
- RESTful conventions
- Proper HTTP status codes
- JSON response format
- Error handling

### 4. Modern CSS
- CSS custom properties
- Flexbox layout
- Smooth transitions
- Mobile-first responsive design

### 5. Client-Side JavaScript
- ES6+ features
- Async/await
- Event delegation
- DOM manipulation

## Extending the App

### Add User Authentication
```typescript
import { auth } from 'openspeed/plugins/auth';

app.use(auth({ secret: process.env.JWT_SECRET }));
```

### Add Database
```typescript
import { database } from 'openspeed/plugins/database';

app.use(database({
  type: 'mongodb',
  connection: process.env.DATABASE_URL
}));
```

### Add File Upload
```typescript
import { upload } from 'openspeed/plugins/upload';

app.use(upload({ dest: './uploads' }));
```

## Deployment

### Development
```bash
pnpm run dev
```

### Production
```bash
pnpm run build
pnpm start
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Learn More

- [OpenSpeed Documentation](https://openspeed.dev)
- [JSX Plugin Guide](https://openspeed.dev/plugins/jsx)
- [API Reference](https://openspeed.dev/api)

---

Built with ❤️ using [OpenSpeed](https://openspeed.dev)
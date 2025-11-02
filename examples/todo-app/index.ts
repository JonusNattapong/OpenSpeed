import { createApp } from 'openspeed';
import { jsx, html } from 'openspeed/plugins/jsx';
import { static } from 'openspeed/plugins/static';
import { cors } from 'openspeed/plugins/cors';
import { security, securityPresets } from 'openspeed/plugins/security';

// Create the app
const app = createApp();

// Use JSX plugin
app.use(jsx());

// Security middleware
app.use(security(securityPresets.production));

// CORS middleware
app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true
}));

// Static file serving
app.use(static({
  root: './public',
  prefix: '/static'
}));

// In-memory todo store (in production, use a database)
let todos = [
  { id: 1, text: 'Learn OpenSpeed', completed: true },
  { id: 2, text: 'Build a web app', completed: false },
  { id: 3, text: 'Deploy to production', completed: false }
];

// Components
function TodoItem({ todo, onToggle, onDelete }) {
  return html`
    <li class="todo-item ${todo.completed ? 'completed' : ''}">
      <input
        type="checkbox"
        checked=${todo.completed}
        onchange=${() => onToggle(todo.id)}
      />
      <span class="todo-text">${todo.text}</span>
      <button
        class="delete-btn"
        onclick=${() => onDelete(todo.id)}
      >
        ×
      </button>
    </li>
  `;
}

function TodoList({ todos, onToggle, onDelete }) {
  return html`
    <ul class="todo-list">
      ${todos.map(todo => TodoItem({ todo, onToggle, onDelete }))}
    </ul>
  `;
}

function TodoForm({ onAdd }) {
  return html`
    <form class="todo-form" onsubmit=${onAdd}>
      <input
        type="text"
        name="text"
        placeholder="What needs to be done?"
        required
        autocomplete="off"
      />
      <button type="submit">Add Todo</button>
    </form>
  `;
}

function Layout({ children, title = 'OpenSpeed Todo App' }) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <link rel="stylesheet" href="/static/style.css">
      </head>
      <body>
        <div class="container">
          <header>
            <h1>${title}</h1>
          </header>
          <main>
            ${children}
          </main>
          <footer>
            <p>Built with <a href="https://openspeed.dev">OpenSpeed</a></p>
          </footer>
        </div>
        <script src="/static/app.js"></script>
      </body>
    </html>
  `;
}

// Routes
app.get('/', (ctx) => {
  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;

  return ctx.html(Layout({
    children: html`
      <div class="todo-app">
        <div class="stats">
          <span>${completedCount} of ${totalCount} completed</span>
        </div>

        ${TodoForm({
          onAdd: 'handleAddTodo(event)'
        })}

        ${TodoList({
          todos,
          onToggle: 'handleToggleTodo',
          onDelete: 'handleDeleteTodo'
        })}
      </div>
    `
  }));
});

// API Routes
app.get('/api/todos', (ctx) => {
  return ctx.json({
    success: true,
    data: todos,
    count: todos.length
  });
});

app.post('/api/todos', async (ctx) => {
  try {
    const { text } = await ctx.req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return ctx.json({
        success: false,
        error: 'Todo text is required'
      }, 400);
    }

    const newTodo = {
      id: Date.now(),
      text: text.trim(),
      completed: false
    };

    todos.push(newTodo);

    return ctx.json({
      success: true,
      data: newTodo
    }, 201);
  } catch (error) {
    return ctx.json({
      success: false,
      error: 'Invalid JSON'
    }, 400);
  }
});

app.put('/api/todos/:id', async (ctx) => {
  try {
    const id = parseInt(ctx.params.id);
    const { completed, text } = await ctx.req.json();

    const todo = todos.find(t => t.id === id);
    if (!todo) {
      return ctx.json({
        success: false,
        error: 'Todo not found'
      }, 404);
    }

    if (typeof completed === 'boolean') {
      todo.completed = completed;
    }

    if (text && typeof text === 'string') {
      todo.text = text.trim();
    }

    return ctx.json({
      success: true,
      data: todo
    });
  } catch (error) {
    return ctx.json({
      success: false,
      error: 'Invalid request'
    }, 400);
  }
});

app.delete('/api/todos/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const index = todos.findIndex(t => t.id === id);

  if (index === -1) {
    return ctx.json({
      success: false,
      error: 'Todo not found'
    }, 404);
  }

  todos.splice(index, 1);

  return ctx.json({
    success: true,
    message: 'Todo deleted'
  });
});

// Health check
app.get('/health', (ctx) => {
  return ctx.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    todos: todos.length
  });
});

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch
};
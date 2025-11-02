// Todo App JavaScript
class TodoApp {
  constructor() {
    this.todos = [];
    this.init();
  }

  async init() {
    await this.loadTodos();
    this.bindEvents();
  }

  async loadTodos() {
    try {
      const response = await fetch('/api/todos');
      const result = await response.json();

      if (result.success) {
        this.todos = result.data;
        this.render();
      }
    } catch (error) {
      console.error('Failed to load todos:', error);
    }
  }

  bindEvents() {
    // Form submission
    document.addEventListener('submit', (e) => {
      if (e.target.classList.contains('todo-form')) {
        e.preventDefault();
        this.handleAddTodo(e);
      }
    });

    // Todo actions
    document.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        const todoId = parseInt(e.target.closest('.todo-item').dataset.id);
        this.handleToggleTodo(todoId);
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) {
        const todoId = parseInt(e.target.closest('.todo-item').dataset.id);
        this.handleDeleteTodo(todoId);
      }
    });
  }

  async handleAddTodo(event) {
    const formData = new FormData(event.target);
    const text = formData.get('text');

    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      const result = await response.json();

      if (result.success) {
        this.todos.push(result.data);
        this.render();
        event.target.reset();
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error('Failed to add todo:', error);
      alert('Failed to add todo');
    }
  }

  async handleToggleTodo(todoId) {
    const todo = this.todos.find(t => t.id === todoId);
    if (!todo) return;

    try {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: !todo.completed }),
      });

      const result = await response.json();

      if (result.success) {
        todo.completed = !todo.completed;
        this.render();
      }
    } catch (error) {
      console.error('Failed to toggle todo:', error);
    }
  }

  async handleDeleteTodo(todoId) {
    if (!confirm('Are you sure you want to delete this todo?')) {
      return;
    }

    try {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        this.todos = this.todos.filter(t => t.id !== todoId);
        this.render();
      }
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  }

  render() {
    const todoList = document.querySelector('.todo-list');
    const stats = document.querySelector('.stats span');

    if (!todoList || !stats) return;

    // Update stats
    const completedCount = this.todos.filter(t => t.completed).length;
    stats.textContent = `${completedCount} of ${this.todos.length} completed`;

    // Render todos
    todoList.innerHTML = this.todos.map(todo => `
      <li class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
        <input type="checkbox" ${todo.completed ? 'checked' : ''}>
        <span class="todo-text">${this.escapeHtml(todo.text)}</span>
        <button class="delete-btn">×</button>
      </li>
    `).join('');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TodoApp();
});

// Global functions for inline event handlers
window.handleAddTodo = function(event) {
  // This will be handled by the event listener
};

window.handleToggleTodo = function(todoId) {
  // This will be handled by the event listener
};

window.handleDeleteTodo = function(todoId) {
  // This will be handled by the event listener
};
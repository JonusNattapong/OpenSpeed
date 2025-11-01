import type { Context } from '../../../../src/openspeed/context.js';

// Mock users data (same as in index.ts)
const users = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'user' },
  { id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'moderator' },
  { id: 5, name: 'Eve Wilson', email: 'eve@example.com', role: 'user' },
];

export async function GET(ctx: Context) {
  const { id } = ctx.params;

  if (!id) {
    return ctx.json({ error: 'User ID is required' }, { status: 400 });
  }

  const userId = parseInt(id);
  if (isNaN(userId)) {
    return ctx.json({ error: 'Invalid user ID format' }, { status: 400 });
  }

  const user = users.find((u) => u.id === userId);
  if (!user) {
    return ctx.json({ error: 'User not found' }, { status: 404 });
  }

  return ctx.json({
    user,
    timestamp: new Date().toISOString(),
  });
}

export async function PUT(ctx: Context) {
  const { id } = ctx.params;

  if (!id) {
    return ctx.json({ error: 'User ID is required' }, { status: 400 });
  }

  const userId = parseInt(id);
  if (isNaN(userId)) {
    return ctx.json({ error: 'Invalid user ID format' }, { status: 400 });
  }

  const userIndex = users.findIndex((u) => u.id === userId);
  if (userIndex === -1) {
    return ctx.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const body = await ctx.req.json();

    // Update user (only allow updating name and role)
    if (body.name !== undefined) {
      users[userIndex].name = body.name;
    }
    if (body.role !== undefined) {
      users[userIndex].role = body.role;
    }

    return ctx.json({
      user: users[userIndex],
      message: 'User updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return ctx.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

export async function DELETE(ctx: Context) {
  const { id } = ctx.params;

  if (!id) {
    return ctx.json({ error: 'User ID is required' }, { status: 400 });
  }

  const userId = parseInt(id);
  if (isNaN(userId)) {
    return ctx.json({ error: 'Invalid user ID format' }, { status: 400 });
  }

  const userIndex = users.findIndex((u) => u.id === userId);
  if (userIndex === -1) {
    return ctx.json({ error: 'User not found' }, { status: 404 });
  }

  const deletedUser = users.splice(userIndex, 1)[0];

  return ctx.json({
    user: deletedUser,
    message: 'User deleted successfully',
    timestamp: new Date().toISOString(),
  });
}

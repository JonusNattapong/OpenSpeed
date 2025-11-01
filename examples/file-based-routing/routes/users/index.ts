import type { Context } from '../../../../src/openspeed/context.js';

// Mock users data
const users = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'user' },
  { id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'moderator' },
  { id: 5, name: 'Eve Wilson', email: 'eve@example.com', role: 'user' },
];

export async function GET(ctx: Context) {
  const { searchParams } = new URL(ctx.req.url);
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = parseInt(searchParams.get('offset') || '0');
  const role = searchParams.get('role');

  let filteredUsers = users;

  // Filter by role if specified
  if (role) {
    filteredUsers = users.filter(user => user.role === role);
  }

  // Apply pagination
  const paginatedUsers = filteredUsers.slice(offset, offset + limit);

  return ctx.json({
    users: paginatedUsers,
    total: filteredUsers.length,
    limit,
    offset,
    hasMore: offset + limit < filteredUsers.length,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(ctx: Context) {
  try {
    const body = await ctx.req.json();

    // Validate required fields
    if (!body.name || !body.email) {
      return ctx.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = users.find(user => user.email === body.email);
    if (existingUser) {
      return ctx.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    // Create new user
    const newUser = {
      id: Math.max(...users.map(u => u.id)) + 1,
      name: body.name,
      email: body.email,
      role: body.role || 'user',
    };

    users.push(newUser);

    return ctx.json(newUser, { status: 201 });
  } catch (error) {
    return ctx.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
}

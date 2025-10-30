export async function GET(ctx: any) {
  // Simulate getting all users
  return ctx.json({
    users: [
      { id: 1, name: 'ElonDuck', email: 'ElonDuck@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ],
    total: 2
  });
}

export async function POST(ctx: any) {
  const body = await ctx.req.json();

  // Simulate creating user
  const newUser = {
    id: Date.now(),
    ...body,
    createdAt: new Date().toISOString()
  };

  return ctx.json({
    message: 'User created successfully',
    user: newUser
  });
}
export async function GET(ctx: any) {
  const { id } = ctx.params;

  // Simulate getting user by ID
  const user = {
    id: parseInt(id),
    name: id === '1' ? 'ElonDuck' : 'Jane Smith',
    email: id === '1' ? 'ElonDuck@example.com' : 'jane@example.com'
  };

  return ctx.json({ user });
}

export async function PUT(ctx: any) {
  const { id } = ctx.params;
  const body = await ctx.req.json();

  // Simulate updating user
  const updatedUser = {
    id: parseInt(id),
    ...body,
    updatedAt: new Date().toISOString()
  };

  return ctx.json({
    message: 'User updated successfully',
    user: updatedUser
  });
}

export async function DELETE(ctx: any) {
  const { id } = ctx.params;

  // Simulate deleting user
  return ctx.json({
    message: 'User deleted successfully',
    id: parseInt(id)
  });
}
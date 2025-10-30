export async function GET(ctx: any) {
  return ctx.json({
    message: 'Hello from file-based routing!',
    timestamp: new Date().toISOString(),
    version: '0.2.0'
  });
}

export async function POST(ctx: any) {
  const body = await ctx.req.json();
  return ctx.json({
    message: 'POST received',
    data: body,
    timestamp: new Date().toISOString()
  });
}
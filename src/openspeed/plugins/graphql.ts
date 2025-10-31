import { graphql, GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLInt, GraphQLList, GraphQLNonNull } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { Context } from '../context.js';

export interface GraphQLOptions {
  schema: string;
  resolvers: Record<string, any>;
  endpoint?: string;
  playground?: boolean;
}

export function graphqlPlugin(options: GraphQLOptions) {
  const { schema, resolvers, endpoint = '/graphql', playground = true } = options;

  const executableSchema = makeExecutableSchema({
    typeDefs: schema,
    resolvers,
  });

  return async (ctx: Context, next: () => Promise<any>) => {
    const url = new URL(ctx.req.url);
    if (url.pathname !== endpoint) {
      return next();
    }

    if (ctx.req.method === 'GET' && playground) {
      // Simple GraphQL playground
      ctx.res.headers = { ...ctx.res.headers, 'content-type': 'text/html' };
      ctx.res.body = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>GraphQL Playground</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
          <link rel="shortcut icon" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/favicon.ico" />
          <script src="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
        </head>
        <body>
          <div id="root"></div>
          <script src="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/vendor.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/app.js"></script>
        </body>
        </html>
      `;
      return;
    }

    if (ctx.req.method === 'POST') {
      const { query, variables, operationName } = ctx.req.body as any;
      const result = await graphql({
        schema: executableSchema,
        source: query,
        variableValues: variables,
        operationName,
        contextValue: ctx,
      });

      ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
      ctx.res.body = JSON.stringify(result);
      return;
    }

    ctx.res.status = 405;
    ctx.res.body = 'Method not allowed';
  };
}

// Export alias for compatibility
export { graphqlPlugin as graphql };
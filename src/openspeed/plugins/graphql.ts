import { graphql, GraphQLSchema, parse, validate, execute, subscribe, GraphQLError } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { printSchema } from 'graphql/utilities';
import DataLoader from 'dataloader';
import { PubSub } from 'graphql-subscriptions';
import type { Context } from '../context.js';
import type { WebSocket } from 'ws';

// Type definitions for GraphQL integration
export interface GraphQLOptions {
  schema: string;
  resolvers?: Record<string, any>;
  endpoint?: string;
  subscriptionsEndpoint?: string;
  playground?: boolean;
  introspection?: boolean;
  dataLoaders?: Record<string, () => DataLoader<any, any>>;
  context?: (ctx: Context) => Record<string, any>;
  formatError?: (error: GraphQLError) => any;
  validationRules?: any[];
}

export interface GraphQLContext extends Context {
  dataLoaders: Record<string, DataLoader<any, any>>;
  pubsub: PubSub;
}

export interface SubscriptionContext {
  pubsub: PubSub;
  connection: WebSocket;
  context: Record<string, any>;
}

// DataLoader factory for efficient batching
export class DataLoaderFactory {
  private loaders = new Map<string, DataLoader<any, any>>();

  createLoader<T, K>(
    name: string,
    batchFn: (keys: readonly K[]) => Promise<T[]>,
    options: DataLoader.Options<K, T> = {}
  ): DataLoader<K, T> {
    if (this.loaders.has(name)) {
      return this.loaders.get(name)!;
    }

    const loader = new DataLoader<K, T>(batchFn, {
      cache: true,
      ...options,
    });

    this.loaders.set(name, loader);
    return loader;
  }

  getLoader(name: string): DataLoader<any, any> | undefined {
    return this.loaders.get(name);
  }

  clearAll(): void {
    this.loaders.clear();
  }

  primeAll(key: any, value: any): void {
    for (const loader of this.loaders.values()) {
      loader.prime(key, value);
    }
  }
}

// Schema-first development utilities
export class GraphQLSchemaBuilder {
  private typeDefs: string[] = [];
  private resolvers: Record<string, any> = {};
  private dataLoaderFactory = new DataLoaderFactory();

  addTypeDefs(typeDefs: string): GraphQLSchemaBuilder {
    this.typeDefs.push(typeDefs);
    return this;
  }

  addResolvers(resolvers: Record<string, any>): GraphQLSchemaBuilder {
    Object.assign(this.resolvers, resolvers);
    return this;
  }

  addDataLoader<T, K>(
    name: string,
    batchFn: (keys: readonly K[]) => Promise<T[]>,
    options?: DataLoader.Options<K, T>
  ): GraphQLSchemaBuilder {
    this.dataLoaderFactory.createLoader(name, batchFn, options);
    return this;
  }

  // Auto-generate resolvers from schema annotations
  generateResolvers(dataSources: Record<string, any>): GraphQLSchemaBuilder {
    // This would parse schema directives and generate resolvers
    // For now, we'll implement a basic version
    const autoResolvers: Record<string, any> = {};

    // Parse schema and generate basic CRUD resolvers
    const schema = this.typeDefs.join('\n');
    const parsedSchema = parse(schema);

    // Implementation would analyze the schema and create resolvers
    // based on naming conventions and data sources

    Object.assign(this.resolvers, autoResolvers);
    return this;
  }

  build(): {
    schema: GraphQLSchema;
    resolvers: Record<string, any>;
    dataLoaders: DataLoaderFactory;
  } {
    const schema = makeExecutableSchema({
      typeDefs: this.typeDefs,
      resolvers: this.resolvers,
    });

    return {
      schema,
      resolvers: this.resolvers,
      dataLoaders: this.dataLoaderFactory,
    };
  }
}

// Type generation utilities
export class TypeGenerator {
  static generateTypes(schema: GraphQLSchema, outputPath?: string): string {
    const schemaString = printSchema(schema);

    // Generate TypeScript types from GraphQL schema
    const types = this.schemaToTypes(schemaString);

    if (outputPath) {
      // In a real implementation, this would write to a file
      console.log(`Generated types would be written to: ${outputPath}`);
    }

    return types;
  }

  private static schemaToTypes(schema: string): string {
    // Basic type generation - in production, use graphql-code-generator
    return `
/* Auto-generated TypeScript types from GraphQL schema */

export interface GraphQLContext {
  dataLoaders: Record<string, any>;
  pubsub: any;
}

// Add your generated types here
export type ID = string;
export type DateTime = string;
`;
  }
}

// Subscription manager for real-time updates
export class SubscriptionManager {
  private pubsub = new PubSub();
  private subscriptions = new Map<string, Set<WebSocket>>();

  async subscribe(topic: string, callback: (payload: any) => void): Promise<number> {
    return this.pubsub.subscribe(topic, callback);
  }

  async unsubscribe(subId: number): Promise<void> {
    this.pubsub.unsubscribe(subId);
  }

  async publish(topic: string, payload: any): Promise<void> {
    await this.pubsub.publish(topic, payload);
  }

  // WebSocket subscription handling
  handleWebSocketSubscription(connection: WebSocket, context: SubscriptionContext): void {
    connection.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'connection_init':
            // Send connection acknowledgment
            connection.send(
              JSON.stringify({
                type: 'connection_ack',
                payload: {},
              })
            );
            break;

          case 'start':
            // Handle subscription start
            const { id, payload } = message;
            const { query, variables, operationName } = payload;

            // Execute subscription
            const result = await subscribe({
              schema: context.pubsub['schema'], // Would need proper schema access
              document: parse(query),
              variableValues: variables,
              operationName,
              contextValue: context,
            });

            // Handle the subscription result
            if (result instanceof Promise) {
              const asyncIterator = result as AsyncIterable<any>;
              for await (const item of asyncIterator) {
                connection.send(
                  JSON.stringify({
                    type: 'data',
                    id,
                    payload: item,
                  })
                );
              }
            }
            break;

          case 'stop':
            // Handle subscription stop
            const { id: stopId } = message;
            // Clean up subscription
            break;
        }
      } catch (error) {
        connection.send(
          JSON.stringify({
            type: 'error',
            payload: { message: error.message },
          })
        );
      }
    });

    connection.on('close', () => {
      // Clean up subscriptions for this connection
    });
  }
}

// Main GraphQL plugin
export function graphqlPlugin(options: GraphQLOptions) {
  const {
    schema: schemaString,
    resolvers = {},
    endpoint = '/graphql',
    subscriptionsEndpoint = '/graphql/subscriptions',
    playground = process.env.NODE_ENV === 'development',
    introspection = true,
    dataLoaders = {},
    context: contextFn,
    formatError,
    validationRules = [],
  } = options;

  // Create schema and resolvers
  const executableSchema = makeExecutableSchema({
    typeDefs: schemaString,
    resolvers,
  });

  // Initialize DataLoader factory
  const dataLoaderFactory = new DataLoaderFactory();
  Object.entries(dataLoaders).forEach(([name, loaderFn]) => {
    dataLoaderFactory.createLoader(name, loaderFn);
  });

  // Initialize subscription manager
  const subscriptionManager = new SubscriptionManager();

  return async (ctx: Context, next: () => Promise<any>) => {
    const url = new URL(ctx.req.url);

    // Handle GraphQL HTTP endpoint
    if (url.pathname === endpoint) {
      return handleGraphQLHTTP(ctx, executableSchema, {
        dataLoaderFactory,
        subscriptionManager,
        playground,
        introspection,
        contextFn,
        formatError,
        validationRules,
      });
    }

    // Handle WebSocket subscriptions
    if (url.pathname === subscriptionsEndpoint) {
      return handleWebSocketSubscription(ctx, subscriptionManager);
    }

    return next();
  };
}

// Handle HTTP GraphQL requests
async function handleGraphQLHTTP(
  ctx: Context,
  schema: GraphQLSchema,
  options: {
    dataLoaderFactory: DataLoaderFactory;
    subscriptionManager: SubscriptionManager;
    playground: boolean;
    introspection: boolean;
    contextFn?: (ctx: Context) => Record<string, any>;
    formatError?: (error: GraphQLError) => any;
    validationRules: any[];
  }
) {
  const {
    dataLoaderFactory,
    subscriptionManager,
    playground,
    introspection,
    contextFn,
    formatError,
    validationRules,
  } = options;

  // Serve GraphQL Playground
  if (ctx.req.method === 'GET' && playground) {
    return servePlayground(ctx);
  }

  // Handle GraphQL queries/mutations
  if (ctx.req.method === 'POST') {
    try {
      const { query, variables, operationName } = ctx.req.body as any;

      // Parse and validate query
      const document = parse(query);
      const validationErrors = validate(schema, document, validationRules);

      if (validationErrors.length > 0) {
        ctx.res.status = 400;
        ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
        ctx.res.body = JSON.stringify({
          errors: validationErrors.map((error) => (formatError ? formatError(error) : error)),
        });
        return;
      }

      // Create context with DataLoaders
      const contextValue: GraphQLContext = {
        ...ctx,
        dataLoaders: dataLoaderFactory,
        pubsub: subscriptionManager['pubsub'],
        ...(contextFn ? contextFn(ctx) : {}),
      } as GraphQLContext;

      // Execute query
      const result = await execute({
        schema,
        document,
        variableValues: variables,
        operationName,
        contextValue,
      });

      // Format errors if needed
      if (result.errors && formatError) {
        result.errors = result.errors.map(formatError);
      }

      ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
      ctx.res.body = JSON.stringify(result);
    } catch (error) {
      const formattedError = formatError ? formatError(error as GraphQLError) : error;
      ctx.res.status = 500;
      ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
      ctx.res.body = JSON.stringify({
        errors: [formattedError],
      });
    }
    return;
  }

  // Method not allowed
  ctx.res.status = 405;
  ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
  ctx.res.body = JSON.stringify({
    error: 'Method not allowed. Use GET for playground or POST for queries.',
  });
}

// Serve GraphQL Playground
function servePlayground(ctx: Context) {
  ctx.res.headers = { ...ctx.res.headers, 'content-type': 'text/html' };
  ctx.res.body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="user-scalable=no, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, minimal-ui">
  <title>GraphQL Playground - OpenSpeed</title>
  <link rel="stylesheet" href="//cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
  <link rel="shortcut icon" href="//cdn.jsdelivr.net/npm/graphql-playground-react/build/favicon.ico" />
  <script src="//cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
</head>
<body>
  <div id="root"></div>
  <script src="//cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/vendor.js"></script>
  <script>
    window.addEventListener('load', function (event) {
      GraphQLPlayground.init(document.getElementById('root'), {
        endpoint: '/graphql',
        subscriptionsEndpoint: '/graphql/subscriptions',
        settings: {
          'editor.theme': 'dark',
          'editor.reuseHeaders': true,
          'tracing.hideTracingResponse': true,
        }
      });
    });
  </script>
</body>
</html>
  `;
}

// Handle WebSocket subscriptions (placeholder - would need WebSocket server integration)
function handleWebSocketSubscription(ctx: Context, subscriptionManager: SubscriptionManager) {
  // This would integrate with a WebSocket server
  // For now, return not implemented
  ctx.res.status = 501;
  ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
  ctx.res.body = JSON.stringify({
    error: 'WebSocket subscriptions not yet implemented in this adapter',
  });
}

// Utility functions for schema-first development
export function createDataLoader<T, K>(
  batchFn: (keys: readonly K[]) => Promise<T[]>,
  options?: DataLoader.Options<K, T>
): () => DataLoader<K, T> {
  return () => new DataLoader<K, T>(batchFn, { cache: true, ...options });
}

// Export utilities
export { GraphQLSchemaBuilder, TypeGenerator, SubscriptionManager, DataLoaderFactory };
export { graphqlPlugin as graphql };

// Helper for creating resolvers with DataLoader
export function createLoaderResolver<T, K>(
  loaderName: string,
  keyFn: (parent: any, args: any, context: GraphQLContext) => K
) {
  return async (parent: any, args: any, context: GraphQLContext) => {
    const loader = context.dataLoaders.getLoader(loaderName);
    if (!loader) {
      throw new Error(`DataLoader '${loaderName}' not found`);
    }
    return loader.load(keyFn(parent, args, context));
  };
}

// Helper for creating batch resolvers
export function createBatchResolver<T>(
  loaderName: string,
  keyFn: (args: any, context: GraphQLContext) => any[]
) {
  return async (parent: any, args: any, context: GraphQLContext) => {
    const loader = context.dataLoaders.getLoader(loaderName);
    if (!loader) {
      throw new Error(`DataLoader '${loaderName}' not found`);
    }
    const keys = keyFn(args, context);
    return loader.loadMany(keys);
  };
}

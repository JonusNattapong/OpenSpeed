import type { Context } from '../context.js';
import type { ZodSchema } from 'zod';
import { zodToTs, createAuxiliaryTypeStore } from 'zod-to-ts';

interface RouteInfo {
  method: string;
  path: string;
  description?: string;
  requestBody?: ZodSchema;
  responses?: Record<string, { schema?: ZodSchema; description?: string }>;
  parameters?: Array<{
    name: string;
    in: 'path' | 'query' | 'header';
    required?: boolean;
    schema: ZodSchema;
    description?: string;
  }>;
}

export function openapi(options: { title?: string; version?: string } = {}) {
  const routes: RouteInfo[] = [];
  const { title = 'OpenSpeed API', version = '1.0.0' } = options;

  const api = {
    collect: (method: string, path: string, options: string | Partial<RouteInfo> = {}) => {
      const routeInfo: Partial<RouteInfo> =
        typeof options === 'string' ? { description: options } : options;

      routes.push({
        method: method.toLowerCase(),
        path,
        ...routeInfo,
      });
    },
    generate: () => {
      const paths: Record<string, any> = {};

      for (const route of routes) {
        const path = route.path.replace(/:(\w+)/g, '{$1}');
        if (!paths[path]) paths[path] = {};

        const operation: any = {
          description: route.description || '',
          responses: {},
        };

        // Add parameters
        if (route.parameters) {
          operation.parameters = route.parameters.map((param) => ({
            name: param.name,
            in: param.in,
            required: param.required,
            description: param.description,
            schema: zodToOpenAPISchema(param.schema),
          }));
        }

        // Add path parameters from route
        const pathParams = route.path.match(/:(\w+)/g);
        if (pathParams) {
          operation.parameters = operation.parameters || [];
          for (const param of pathParams) {
            const name = param.slice(1);
            if (!operation.parameters.find((p: any) => p.name === name && p.in === 'path')) {
              operation.parameters.push({
                name,
                in: 'path',
                required: true,
                schema: { type: 'string' },
              });
            }
          }
        }

        // Add request body
        if (route.requestBody && ['post', 'put', 'patch'].includes(route.method)) {
          operation.requestBody = {
            required: true,
            content: {
              'application/json': {
                schema: zodToOpenAPISchema(route.requestBody),
              },
            },
          };
        }

        // Add responses
        if (route.responses) {
          for (const [status, response] of Object.entries(route.responses)) {
            operation.responses[status] = {
              description: response.description || 'Success',
              content: response.schema
                ? {
                    'application/json': {
                      schema: zodToOpenAPISchema(response.schema),
                    },
                  }
                : undefined,
            };
          }
        } else {
          operation.responses['200'] = { description: 'Success' };
        }

        paths[path][route.method] = operation;
      }

      return {
        openapi: '3.0.0',
        info: { title, version },
        paths,
      };
    },

    generateClient: () => {
      let types = '';
      let clientCode = `// Generated OpenSpeed Client with End-to-End Type Safety
// Provides auto-completion, runtime validation, and type inference
import { z } from 'zod';

`;

      for (const route of routes) {
        const path = route.path;
        const method = route.method.toUpperCase();
        const funcName = path.replace(/:/g, '$').replace(/\//g, '_').replace(/^_/, '') || 'root';

        // Collect parameters
        const pathParams: Array<{ name: string; schema: ZodSchema }> = [];
        const queryParams: Array<{ name: string; schema: ZodSchema }> = [];
        const headerParams: Array<{ name: string; schema: ZodSchema }> = [];

        if (route.parameters) {
          for (const param of route.parameters) {
            if (param.in === 'path') pathParams.push({ name: param.name, schema: param.schema });
            else if (param.in === 'query')
              queryParams.push({ name: param.name, schema: param.schema });
            else if (param.in === 'header')
              headerParams.push({ name: param.name, schema: param.schema });
          }
        }

        // Add path params from route path if not already
        const pathParamNames = (route.path.match(/:(\w+)/g) || []).map((p) => p.slice(1));
        for (const name of pathParamNames) {
          if (!pathParams.find((p) => p.name === name)) {
            pathParams.push({ name, schema: { type: 'string' } as any }); // Assume string
          }
        }

        // Generate types for path params
        if (pathParams.length > 0) {
          const pathParamTypes = pathParams
            .map(
              (p) =>
                `${p.name}: ${zodToTs(p.schema, { auxiliaryTypeStore: createAuxiliaryTypeStore() }).node}`
            )
            .join(', ');
          types += `export type ${funcName}PathParams = {${pathParamTypes}};\n`;
        }

        // Generate types for query params
        if (queryParams.length > 0) {
          const queryParamTypes = queryParams
            .map(
              (p) =>
                `${p.name}?: ${zodToTs(p.schema, { auxiliaryTypeStore: createAuxiliaryTypeStore() }).node}`
            )
            .join(', ');
          types += `export type ${funcName}QueryParams = {${queryParamTypes}};\n`;
        }

        // Generate types for request body
        let requestType = 'void';
        if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
          const tsType = zodToTs(route.requestBody, {
            auxiliaryTypeStore: createAuxiliaryTypeStore(),
          });
          requestType = `${funcName}Request`;
          types += `export type ${requestType} = ${tsType.node};\n`;
        }

        // Generate types and schemas for responses
        let responseType = 'Response';
        if (route.responses && route.responses['200']?.schema) {
          const tsType = zodToTs(route.responses['200'].schema, {
            auxiliaryTypeStore: createAuxiliaryTypeStore(),
          });
          responseType = `${funcName}Response`;
          types += `export type ${responseType} = ${tsType.node};\n`;
          types += `export const ${funcName}ResponseSchema = ${zodToZodCode(route.responses['200'].schema)};\n`;
        }

        // Build parameter list
        const paramList: string[] = [];
        if (pathParams.length > 0) paramList.push(`pathParams: ${funcName}PathParams`);
        if (queryParams.length > 0) paramList.push(`queryParams?: ${funcName}QueryParams`);
        if (requestType !== 'void') paramList.push(`body: ${requestType}`);
        paramList.push(`options?: {headers?: Record<string, string>; auth?: string}`);
        const params = paramList.join(', ');

        // Generate method signature
        clientCode += `  async ${funcName}(${params}): Promise<${responseType}> {\n`;

        // Generate URL construction
        let urlTemplate = route.path;
        for (const p of pathParams) {
          urlTemplate = urlTemplate.replace(`:${p.name}`, `\${pathParams.${p.name}}`);
        }
        clientCode += `    let url = \`\${this.baseURL}${urlTemplate}\`;\n`;

        if (queryParams.length > 0) {
          clientCode += `    const searchParams = new URLSearchParams();\n`;
          for (const p of queryParams) {
            clientCode += `    if (queryParams.${p.name} !== undefined) searchParams.append('${p.name}', String(queryParams.${p.name}));\n`;
          }
          clientCode += `    url += '?' + searchParams.toString();\n`;
        }

        // Headers
        clientCode += `    const headers: Record<string, string> = { ...options?.headers };\n`;
        if (requestType !== 'void') {
          clientCode += `    headers['Content-Type'] = 'application/json';\n`;
        }
        clientCode += `    if (options?.auth) headers['Authorization'] = options.auth;\n`;

        // Fetch call
        clientCode += `    return fetch(url, {\n`;
        clientCode += `      method: '${method}',\n`;
        clientCode += `      headers,\n`;
        if (requestType !== 'void') {
          clientCode += `      body: JSON.stringify(body),\n`;
        }
        clientCode += `    }).then(async (res) => {\n`;
        clientCode += `      if (!res.ok) throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);\n`;
        if (responseType !== 'Response') {
          clientCode += `      const data = await res.json();\n`;
          clientCode += `      return ${funcName}ResponseSchema.parse(data);\n`;
        } else {
          clientCode += `      return res;\n`;
        }
        clientCode += `    });\n`;
        clientCode += `  }\n\n`;
      }

      clientCode =
        types +
        `\nexport class OpenSpeedClient {\n  constructor(private baseURL: string = '') {}\n\n` +
        clientCode +
        `}\n`;
      return clientCode;
    },

    middleware: async (ctx: Context, next: () => Promise<any>) => {
      // NOTE: localhost URL is only used as base for pathname parsing, not for actual connection
      const pathname = new URL(ctx.req.url, 'http://localhost').pathname;
      if (pathname === '/openapi.json') {
        ctx.res.status = 200;
        ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
        ctx.res.body = JSON.stringify(api.generate(), null, 2);
        return;
      }
      if (pathname === '/client.ts') {
        ctx.res.status = 200;
        ctx.res.headers = { ...ctx.res.headers, 'content-type': 'text/plain' };
        ctx.res.body = api.generateClient();
        return;
      }
      await next();
    },
  };

  return api;
}

// Helper function to convert Zod schema to OpenAPI schema (basic implementation)
function zodToOpenAPISchema(schema: ZodSchema): any {
  // This is a basic implementation. For production, consider using a library like zod-to-openapi
  try {
    const shape = (schema as any)._def.shape?.();
    if (shape) {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, fieldSchema] of Object.entries(shape)) {
        properties[key] = zodToOpenAPISchema(fieldSchema as ZodSchema);
        if (!(fieldSchema as any)._def.optional) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    const typeName = (schema as any)._def.typeName;
    switch (typeName) {
      case 'ZodString':
        return { type: 'string' };
      case 'ZodNumber':
        return { type: 'number' };
      case 'ZodBoolean':
        return { type: 'boolean' };
      case 'ZodArray':
        return {
          type: 'array',
          items: zodToOpenAPISchema((schema as any)._def.element),
        };
      default:
        return { type: 'string' }; // fallback
    }
  } catch {
    return { type: 'string' };
  }
}

// Helper function to convert Zod schema to Zod code for runtime validation
function zodToZodCode(schema: ZodSchema): string {
  try {
    const typeName = (schema as any)._def.typeName;
    switch (typeName) {
      case 'ZodString':
        return 'z.string()';
      case 'ZodNumber':
        return 'z.number()';
      case 'ZodBoolean':
        return 'z.boolean()';
      case 'ZodArray':
        return `z.array(${zodToZodCode((schema as any)._def.element)})`;
      case 'ZodObject': {
        const shape = (schema as any)._def.shape();
        const props = Object.entries(shape)
          .map(([k, v]) => `${k}: ${zodToZodCode(v as ZodSchema)}`)
          .join(', ');
        return `z.object({${props}})`;
      }
      default:
        return 'z.any()';
    }
  } catch {
    return 'z.any()';
  }
}

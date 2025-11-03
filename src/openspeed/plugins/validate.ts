/**
 * Enhanced Validation Plugin for OpenSpeed
 * Supports multiple validators via Standard Schema (Zod, Valibot, ArkType, Effect, etc.)
 */

import type { Context } from '../context.js';

// Standard Schema interface (v1)
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardSchemaV1Result<Output>;
  };
}

export interface StandardSchemaV1Result<Output> {
  readonly value?: Output;
  readonly issues?: ReadonlyArray<StandardSchemaV1Issue>;
}

export interface StandardSchemaV1Issue {
  readonly message: string;
  readonly path?: ReadonlyArray<string | number>;
}

// Generic validator type (supports both Standard Schema and legacy formats)
export type Validator<T = any> =
  | StandardSchemaV1<any, T>
  | { parse: (value: unknown) => T }
  | { safeParse: (value: unknown) => { success: boolean; data?: T; error?: any } };

export interface ValidationOptions {
  body?: Validator;
  params?: Validator;
  query?: Validator;
  headers?: Validator;
  response?: Validator;
  onError?: (error: ValidationError, ctx: Context) => void;
}

export interface ValidationError {
  type: 'body' | 'params' | 'query' | 'headers' | 'response';
  issues: Array<{
    message: string;
    path?: Array<string | number>;
  }>;
}

/**
 * Check if validator uses Standard Schema v1
 */
function isStandardSchema(validator: any): validator is StandardSchemaV1 {
  return validator && typeof validator === 'object' && '~standard' in validator;
}

/**
 * Parse value with any validator type
 */
function parseValue(
  validator: Validator,
  value: unknown
): { success: boolean; data?: any; issues?: any[] } {
  try {
    // Standard Schema v1
    if (isStandardSchema(validator)) {
      const result = validator['~standard'].validate(value);
      if (result.issues && result.issues.length > 0) {
        return {
          success: false,
          issues: result.issues.map((issue) => ({
            message: issue.message,
            path: issue.path ? Array.from(issue.path) : undefined,
          })),
        };
      }
      return { success: true, data: result.value };
    }

    // Zod-style (has parse method)
    if ('parse' in validator && typeof validator.parse === 'function') {
      try {
        const data = validator.parse(value);
        return { success: true, data };
      } catch (error: any) {
        // Handle Zod errors
        if (error.issues) {
          return {
            success: false,
            issues: error.issues.map((issue: any) => ({
              message: issue.message,
              path: issue.path,
            })),
          };
        }
        return {
          success: false,
          issues: [{ message: error.message || 'Validation failed' }],
        };
      }
    }

    // Valibot/ArkType style (has safeParse)
    if ('safeParse' in validator && typeof validator.safeParse === 'function') {
      const result = validator.safeParse(value);
      if (!result.success) {
        return {
          success: false,
          issues: result.error?.issues || [{ message: 'Validation failed' }],
        };
      }
      return { success: true, data: result.data };
    }

    // Fallback - assume it's a function
    if (typeof validator === 'function') {
      const data = (validator as any)(value);
      return { success: true, data };
    }

    throw new Error('Unsupported validator type');
  } catch (error: any) {
    return {
      success: false,
      issues: [{ message: error.message || 'Validation failed' }],
    };
  }
}

/**
 * Main validation middleware
 */
export function validate(options: ValidationOptions) {
  return async (ctx: Context, next: () => Promise<any>) => {
    try {
      // Validate body
      if (options.body && ctx.req.body !== undefined) {
        const result = parseValue(options.body, ctx.req.body);
        if (!result.success) {
          const error: ValidationError = { type: 'body', issues: result.issues || [] };
          if (options.onError) {
            options.onError(error, ctx);
            return;
          }
          ctx.res.status = 400;
          ctx.res.body = JSON.stringify({ error: 'Body validation failed', details: error.issues });
          ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
          return;
        }
        ctx.req.body = result.data;
      }

      // Validate params
      if (options.params) {
        const result = parseValue(options.params, ctx.params);
        if (!result.success) {
          const error: ValidationError = { type: 'params', issues: result.issues || [] };
          if (options.onError) {
            options.onError(error, ctx);
            return;
          }
          ctx.res.status = 400;
          ctx.res.body = JSON.stringify({
            error: 'Params validation failed',
            details: error.issues,
          });
          ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
          return;
        }
        ctx.params = result.data as Record<string, string>;
      }

      // Validate query
      if (options.query) {
        // NOTE: localhost URL is only used as base for URL parsing, not for actual connection
        const url = new URL(ctx.req.url, 'http://localhost');
        const query: Record<string, string> = {};
        for (const [k, v] of url.searchParams) {
          query[k] = v;
        }
        const result = parseValue(options.query, query);
        if (!result.success) {
          const error: ValidationError = { type: 'query', issues: result.issues || [] };
          if (options.onError) {
            options.onError(error, ctx);
            return;
          }
          ctx.res.status = 400;
          ctx.res.body = JSON.stringify({
            error: 'Query validation failed',
            details: error.issues,
          });
          ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
          return;
        }
        ctx.req.query = result.data as Record<string, string>;
      }

      // Validate headers
      if (options.headers) {
        const result = parseValue(options.headers, ctx.req.headers);
        if (!result.success) {
          const error: ValidationError = { type: 'headers', issues: result.issues || [] };
          if (options.onError) {
            options.onError(error, ctx);
            return;
          }
          ctx.res.status = 400;
          ctx.res.body = JSON.stringify({
            error: 'Headers validation failed',
            details: error.issues,
          });
          ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
          return;
        }
        ctx.req.headers = result.data as Record<string, string | string[] | undefined>;
      }

      await next();

      // Validate response
      if (options.response && ctx.res.body) {
        let responseData = ctx.res.body;
        if (typeof responseData === 'string') {
          try {
            responseData = JSON.parse(responseData);
          } catch {
            // Not JSON, skip validation
            return;
          }
        }

        const result = parseValue(options.response, responseData);
        if (!result.success) {
          const error: ValidationError = { type: 'response', issues: result.issues || [] };
          if (options.onError) {
            options.onError(error, ctx);
            return;
          }
          ctx.res.status = 500;
          ctx.res.body = JSON.stringify({
            error: 'Response validation failed',
            details: error.issues,
          });
          ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
          return;
        }
        ctx.res.body = JSON.stringify(result.data);
      }
    } catch (err: any) {
      ctx.res.status = 500;
      ctx.res.body = JSON.stringify({ error: 'Validation error', message: err.message });
      ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
    }
  };
}

/**
 * Helper for creating typed route handlers with validation
 */
export function createValidatedHandler<TBody = any, TParams = any, TQuery = any>(
  schema: {
    body?: Validator<TBody>;
    params?: Validator<TParams>;
    query?: Validator<TQuery>;
  },
  handler: (
    ctx: Context & {
      body: TBody;
      params: TParams;
      query: TQuery;
    }
  ) => any
) {
  return [
    validate(schema),
    async (ctx: Context) => {
      return handler(ctx as any);
    },
  ];
}

/**
 * Example usage:
 *
 * // With Zod
 * import { z } from 'zod';
 * import { validate } from 'openspeed/plugins/validate';
 *
 * app.post('/user', validate({
 *   body: z.object({
 *     name: z.string(),
 *     age: z.number()
 *   })
 * }), (ctx) => {
 *   const { name, age } = ctx.getBody(); // Type-safe!
 *   return ctx.json({ name, age });
 * });
 *
 * // With Valibot
 * import * as v from 'valibot';
 *
 * app.post('/user', validate({
 *   body: v.object({
 *     name: v.string(),
 *     age: v.number()
 *   })
 * }), (ctx) => {
 *   return ctx.json(ctx.getBody());
 * });
 *
 * // With ArkType
 * import { type } from 'arktype';
 *
 * app.post('/user', validate({
 *   body: type({
 *     name: 'string',
 *     age: 'number'
 *   })
 * }), (ctx) => {
 *   return ctx.json(ctx.getBody());
 * });
 */

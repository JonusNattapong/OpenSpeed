import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import type { OpenSpeedApp } from '../index.js';

export function createAWSLambdaHandler(app: OpenSpeedApp) {
  return async function handler(
    event: APIGatewayProxyEvent,
    _context: Context
  ): Promise<APIGatewayProxyResult> {
    void _context;
    try {
      const method = event.httpMethod;
      const path = event.path;
      const queryString = event.queryStringParameters
        ? new URLSearchParams(event.queryStringParameters as Record<string, string>).toString()
        : '';
      const url = queryString ? `${path}?${queryString}` : path;

      const headers: Record<string, string | string[] | undefined> = {};
      if (event.headers) {
        for (const [k, v] of Object.entries(event.headers)) {
          headers[k] = v as string;
        }
      }

      const body = event.body || undefined;

      const requestLike = { method, url, headers, body };
      const out = await app.handle(requestLike);

      if (!out) {
        return {
          statusCode: 204,
          body: '',
          headers: {},
        };
      }

      return {
        statusCode: out.status || 200,
        body: typeof out.body === 'string' ? out.body : JSON.stringify(out.body),
        headers: out.headers as Record<string, string>,
      };
    } catch (err: unknown) {
      console.error(err);
      return {
        statusCode: 500,
        body: 'Internal Server Error',
        headers: { 'content-type': 'text/plain' },
      };
    }
  };
}

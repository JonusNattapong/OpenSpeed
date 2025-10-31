import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export function createAWSLambdaHandler(app: any) {
  return async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    try {
      const method = event.httpMethod;
      const path = event.path;
      const queryString = event.queryStringParameters ? new URLSearchParams(event.queryStringParameters as any).toString() : '';
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
          headers: {}
        };
      }

      return {
        statusCode: out.status || 200,
        body: out.body || '',
        headers: out.headers as Record<string, string>
      };
    } catch (err: any) {
      console.error(err);
      return {
        statusCode: 500,
        body: 'Internal Server Error',
        headers: { 'content-type': 'text/plain' }
      };
    }
  };
}
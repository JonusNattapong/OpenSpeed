export interface RequestLike {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string>;
  user?: unknown; // For authentication middleware
  files?: Record<string, FileUpload[]>; // For file uploads
  file?: FileUpload; // For single file uploads
}

export interface FileUpload {
  filename: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  stream?: unknown;
  path?: string;
}

export interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  priority?: 'low' | 'medium' | 'high';
}

export class CookieJar {
  private cookies = new Map<string, { value: string; options: CookieOptions }>();

  set(name: string, value: string, options: CookieOptions = {}) {
    this.cookies.set(name, { value, options });
  }

  get(name: string): string | undefined {
    return this.cookies.get(name)?.value;
  }

  delete(name: string) {
    this.cookies.delete(name);
  }

  clear() {
    this.cookies.clear();
  }

  entries(): Array<[string, { value: string; options: CookieOptions }]> {
    return Array.from(this.cookies.entries());
  }

  toHeaderString(): string {
    const cookieStrings: string[] = [];

    for (const [name, { value, options }] of this.cookies) {
      let cookieStr = `${name}=${value}`;

      if (options.maxAge !== undefined) {
        cookieStr += `; Max-Age=${options.maxAge}`;
      }

      if (options.expires) {
        cookieStr += `; Expires=${options.expires.toUTCString()}`;
      }

      if (options.path) {
        cookieStr += `; Path=${options.path}`;
      }

      if (options.domain) {
        cookieStr += `; Domain=${options.domain}`;
      }

      if (options.secure) {
        cookieStr += `; Secure`;
      }

      if (options.httpOnly) {
        cookieStr += `; HttpOnly`;
      }

      if (options.sameSite) {
        cookieStr += `; SameSite=${options.sameSite}`;
      }

      if (options.priority) {
        cookieStr += `; Priority=${options.priority}`;
      }

      cookieStrings.push(cookieStr);
    }

    return cookieStrings.join(', ');
  }
}

export interface ResponseLike {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export class Context {
  req: RequestLike;
  res: ResponseLike = { status: 200, headers: {}, body: undefined };
  params: Record<string, string> = {};
  cookies?: CookieJar;
  email?: unknown;
  storage?: unknown;
  twilio?: unknown;
  stripe?: unknown;
  memory?: unknown;
  loadBalancer?: unknown;
  circuitBreaker?: unknown;
  tracing?: unknown;
  metrics?: unknown;
  dashboard?: unknown;
  anomaly?: unknown;
  hotReload?: unknown;
  playground?: unknown;
  codegen?: unknown;

  // ML Optimizer properties
  resourceAllocation?: unknown;
  queryCount?: number;
  cacheHit?: boolean;
  queryExecutions?: unknown[];
  predictionConfidence?: number;
  optimizationApplied?: string;

  constructor(req: RequestLike, params: Record<string, string> = {}) {
    this.req = req;
    this.params = params;
  }

  // Response helpers
  text(text: string, status = 200): ResponseLike {
    this.res.status = status;
    this.res.headers = { ...this.res.headers, 'content-type': 'text/plain; charset=utf-8' };
    this.res.body = text;
    return this.res;
  }

  json(data: unknown, status = 200): ResponseLike {
    this.res.status = status;
    this.res.headers = { ...this.res.headers, 'content-type': 'application/json' };
    this.res.body = JSON.stringify(data);
    return this.res;
  }

  html(html: string, status = 200): ResponseLike {
    this.res.status = status;
    this.res.headers = { ...this.res.headers, 'content-type': 'text/html' };
    this.res.body = html;
    return this.res;
  }

  redirect(url: string, status = 302): ResponseLike {
    this.res.status = status;
    this.res.headers = { ...this.res.headers, Location: url };
    return this.res;
  }

  setHeader(name: string, value: string): this {
    this.res.headers = { ...this.res.headers, [name]: value };
    return this;
  }

  getHeader(name: string): string | string[] | undefined {
    return this.res.headers?.[name];
  }

  setStatus(status: number): this {
    this.res.status = status;
    return this;
  }

  // Request helpers
  getQuery(name: string): string | undefined {
    return this.req.query?.[name];
  }

  getParam(name: string): string | undefined {
    return this.params[name];
  }

  getBody(): unknown {
    return this.req.body;
  }

  getUser(): unknown {
    return this.req.user;
  }

  // Cookie helpers
  // NOTE: Cookie security is enforced by the CookieJar with secure defaults
  // See plugins/cookie.ts for httpOnly, secure, and sameSite configurations
  setCookie(name: string, value: string, options?: CookieOptions): this {
    if (this.cookies) {
      this.cookies.set(name, value, options);
    }
    return this;
  }

  getCookie(name: string): string | undefined {
    return this.cookies?.get(name);
  }
}

export default Context;

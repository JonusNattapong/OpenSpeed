export type Handler<Req = unknown, Res = unknown> = (ctx: unknown) => Promise<unknown> | unknown;

interface RouteMatch {
  handler: Handler;
  params: Record<string, string>;
  middlewares: string[];
}

class TrieNode {
  part: string;
  handlers: Map<string, Handler> = new Map();
  staticChildren: Map<string, TrieNode> = new Map();
  paramChild: TrieNode | null = null;
  paramName: string | null = null;
  wildcardChild: TrieNode | null = null;
  isParam: boolean;
  isWildcard: boolean;
  routeKey: string | null = null; // Store the route key for middleware lookup

  constructor(part: string, isParam = false, isWildcard = false) {
    this.part = part;
    this.isParam = isParam;
    this.isWildcard = isWildcard;
    if (isParam) {
      this.paramName = part.slice(1);
    }
  }
}

export default class Router {
  root = new TrieNode('');
  private routeTable = new Map<string, { method: string; path: string; middlewares: string[] }>();
  private routeCache = new Map<string, RouteMatch | null>();
  private cacheEnabled = true;

  add(method: string, path: string, handler: Handler, middlewares: string[] = []) {
    const parts = this._split(path);
    let node = this.root;
    for (const part of parts) {
      const isParam = part.charCodeAt(0) === 58; // ':'
      const isWildcard = part === '*';
      let child: TrieNode | undefined | null;

      if (isWildcard) {
        child = node.wildcardChild;
        if (!child) {
          child = new TrieNode(part, false, true);
          node.wildcardChild = child;
        }
      } else if (isParam) {
        child = node.paramChild;
        if (!child) {
          child = new TrieNode(part, true);
          node.paramChild = child;
        }
      } else {
        child = node.staticChildren.get(part);
        if (!child) {
          child = new TrieNode(part, false);
          node.staticChildren.set(part, child);
        }
      }

      node = child;
    }
    const methodKey = method.toUpperCase();
    const routeKey = `${methodKey} ${path}`;
    node.handlers.set(methodKey, handler);
    node.routeKey = routeKey; // Store route key in node for middleware lookup

    if (!this.routeTable.has(routeKey)) {
      this.routeTable.set(routeKey, { method: methodKey, path, middlewares });
    }
  }

  find(method: string, path: string): RouteMatch | null {
    if (this.cacheEnabled) {
      const cacheKey = `${method.toUpperCase()} ${path}`;
      const cached = this.routeCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    const parts = this._split(path);
    let node: TrieNode | null = this.root;
    let params: Record<string, string> | null = null;
    let matchedMiddlewares: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      if (!node) break;

      const part = parts[i];
      let next: TrieNode | null = null;
      let isParamMatch = false;
      let isWildcardMatch = false;

      // Try static match first (fastest)
      next = node.staticChildren.get(part) || null;

      // Try parameter match
      if (!next && node.paramChild) {
        next = node.paramChild;
        isParamMatch = true;
      }

      // Try wildcard match (lowest priority)
      if (!next && node.wildcardChild) {
        next = node.wildcardChild;
        isWildcardMatch = true;
      }

      if (!next) {
        const result = null;
        if (this.cacheEnabled) {
          const cacheKey = `${method.toUpperCase()} ${path}`;
          this.routeCache.set(cacheKey, result);
        }
        return result;
      }

      if (isParamMatch && next.paramName) {
        if (!params) params = {};
        params[next.paramName] = decodeURIComponent(part);
      }

      if (isWildcardMatch) {
        // For wildcard, capture the rest of the path
        if (!params) params = {};
        params['*'] = parts.slice(i).join('/');
        break;
      }

      node = next;
    }

    if (!node) {
      const result = null;
      if (this.cacheEnabled) {
        const cacheKey = `${method.toUpperCase()} ${path}`;
        this.routeCache.set(cacheKey, result);
      }
      return result;
    }

    const handler = node.handlers.get(method.toUpperCase());
    if (!handler) {
      const result = null;
      if (this.cacheEnabled) {
        const cacheKey = `${method.toUpperCase()} ${path}`;
        this.routeCache.set(cacheKey, result);
      }
      return result;
    }

    // Get middlewares for this route
    const routeKey = node.routeKey;
    const routeInfo = routeKey ? this.routeTable.get(routeKey) : null;
    matchedMiddlewares = routeInfo ? routeInfo.middlewares : [];

    const result: RouteMatch = {
      handler,
      params: params ?? {},
      middlewares: matchedMiddlewares,
    };

    if (this.cacheEnabled) {
      const cacheKey = `${method.toUpperCase()} ${path}`;
      this.routeCache.set(cacheKey, result);
    }

    return result;
  }

  getRoutes() {
    return Array.from(this.routeTable.values());
  }

  // Cache management
  clearCache() {
    this.routeCache.clear();
  }

  enableCache(enabled: boolean = true) {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }

  getCacheStats() {
    return {
      size: this.routeCache.size,
      enabled: this.cacheEnabled,
    };
  }

  private _split(path: string) {
    if (!path || path === '/') return [];
    let start = path.charCodeAt(0) === 47 ? 1 : 0; // '/'
    let end = path.length;

    if (end > start && path.charCodeAt(end - 1) === 47) {
      end -= 1;
    }

    const parts: string[] = [];
    let segmentStart = start;

    for (let i = start; i < end; i++) {
      if (path.charCodeAt(i) === 47) {
        if (i > segmentStart) parts.push(path.slice(segmentStart, i));
        segmentStart = i + 1;
      }
    }

    if (segmentStart < end) {
      parts.push(path.slice(segmentStart, end));
    } else if (parts.length === 0 && start === 0 && end === 0) {
      return [];
    }

    return parts;
  }
}

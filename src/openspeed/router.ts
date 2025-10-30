export type Handler<Req = any, Res = any> = (ctx: any) => Promise<any> | any;

class TrieNode {
  part: string;
  handlers: Map<string, Handler> = new Map();
  staticChildren: Map<string, TrieNode> = new Map();
  paramChild: TrieNode | null = null;
  paramName: string | null = null;
  isParam: boolean;

  constructor(part: string, isParam = false) {
    this.part = part;
    this.isParam = isParam;
    if (isParam) {
      this.paramName = part.slice(1);
    }
  }
}

export class Router {
  root = new TrieNode('');
  private routeTable = new Map<string, { method: string; path: string; middlewares: string[] }>();

  add(method: string, path: string, handler: Handler, middlewares: string[] = []) {
    const parts = this._split(path);
    let node = this.root;
    for (const part of parts) {
      const isParam = part.charCodeAt(0) === 58; // ':'
      let child: TrieNode | undefined | null;

      if (isParam) {
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
    node.handlers.set(methodKey, handler);

    const routeKey = `${methodKey} ${path}`;
    if (!this.routeTable.has(routeKey)) {
      this.routeTable.set(routeKey, { method: methodKey, path, middlewares });
    }
  }

  find(method: string, path: string) {
    const parts = this._split(path);
    let node: TrieNode | null = this.root;
    let params: Record<string, string> | null = null;

    for (const part of parts) {
      if (!node) break;

      let next = node.staticChildren.get(part);
      let isParamMatch = false;

      if (!next && node.paramChild) {
        next = node.paramChild;
        isParamMatch = true;
      }

      if (!next) return null;

      if (isParamMatch && next.paramName) {
        if (!params) params = {};
        params[next.paramName] = decodeURIComponent(part);
      }

      node = next;
    }

    if (!node) return null;
    const handler = node.handlers.get(method.toUpperCase());
    if (!handler) return null;
    return { handler, params: params ?? {} };
  }

  getRoutes() {
    return Array.from(this.routeTable.values());
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

export default Router;

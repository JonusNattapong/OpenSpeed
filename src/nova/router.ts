export type Handler<Req = any, Res = any> = (ctx: any) => Promise<any> | any;

type NodeChildren = Map<string, TrieNode>;

class TrieNode {
  part: string;
  children: NodeChildren = new Map();
  paramName: string | null = null; // if this node is a param like :id
  handlers: Map<string, Handler> = new Map();

  constructor(part: string) {
    this.part = part;
    if (part.startsWith(':')) this.paramName = part.slice(1);
  }
}

export class Router {
  root = new TrieNode('');

  add(method: string, path: string, handler: Handler) {
    const parts = this._split(path);
    let node = this.root;
    for (const part of parts) {
      const key = part.startsWith(':') ? ':' : part;
      let child = node.children.get(key);
      if (!child) {
        child = new TrieNode(part);
        node.children.set(key, child);
      }
      node = child;
    }
    node.handlers.set(method.toUpperCase(), handler);
  }

  find(method: string, path: string) {
    const parts = this._split(path);
    const params: Record<string, string> = {};
    let node: TrieNode | undefined = this.root;
    for (const part of parts) {
      // exact match
      let next = node.children.get(part);
      if (next) {
        node = next;
        continue;
      }
      // param match
      next = node.children.get(':');
      if (next) {
        if (next.paramName) params[next.paramName] = decodeURIComponent(part);
        node = next;
        continue;
      }
      // not found
      node = undefined;
      break;
    }
    if (!node) return null;
    const handler = node.handlers.get(method.toUpperCase());
    if (!handler) return null;
    return { handler, params };
  }

  _split(path: string) {
    return path.replace(/(^\/|\/$)/g, '').split('/').filter(Boolean);
  }
}

export default Router;

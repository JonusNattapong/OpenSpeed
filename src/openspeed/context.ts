export interface RequestLike {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
  query?: Record<string, string>;
}

export interface ResponseLike {
  status?: number;
  headers?: Record<string,string>;
  body?: any;
}

export class Context {
  req: RequestLike;
  res: ResponseLike = { status: 200, headers: {}, body: undefined };
  params: Record<string,string> = {};

  constructor(req: RequestLike, params: Record<string,string> = {}) {
    this.req = req;
    this.params = params;
  }

  json(obj: any, status = 200) {
    this.res.status = status;
    this.res.headers = Object.assign(this.res.headers || {}, { 'content-type': 'application/json' });
    this.res.body = JSON.stringify(obj);
    return this.res;
  }

  text(str: string, status = 200) {
    this.res.status = status;
    this.res.headers = Object.assign(this.res.headers || {}, { 'content-type': 'text/plain; charset=utf-8' });
    this.res.body = str;
    return this.res;
  }
}

export default Context;

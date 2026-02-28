import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { URL } from 'url';
import { logger } from '../utils/logger';

export type RouteHandler = (req: ParsedRequest, res: WrappedResponse) => void | Promise<void>;

export interface ParsedRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  raw: IncomingMessage;
}

export interface WrappedResponse {
  status(code: number): WrappedResponse;
  json(data: any): void;
  text(data: string): void;
  raw: ServerResponse;
}

interface Route {
  method: string;
  pathPattern: string;
  paramNames: string[];
  regex: RegExp;
  handler: RouteHandler;
}

export class ActuatorServer {
  private server: Server | null = null;
  private routes: Route[] = [];
  private port: number;
  private basePath: string;

  constructor(port: number, basePath: string) {
    this.port = port;
    this.basePath = basePath;
  }

  get(path: string, handler: RouteHandler): void {
    this.addRoute('GET', path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.addRoute('POST', path, handler);
  }

  private addRoute(method: string, path: string, handler: RouteHandler): void {
    const paramNames: string[] = [];
    const regexStr = path.replace(/:([^/]+)/g, (_match, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    this.routes.push({
      method,
      pathPattern: path,
      paramNames,
      regex: new RegExp(`^${regexStr}$`),
      handler,
    });
  }

  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handle(req, res).catch((err) => {
          logger.error('Unhandled request error', { error: err.message });
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
          }
        });
      });

      this.server.on('error', reject);

      this.server.listen(this.port, () => {
        const addr = this.server!.address();
        const assignedPort = typeof addr === 'object' && addr ? addr.port : this.port;
        this.port = assignedPort;
        resolve(assignedPort);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
    });
  }

  getPort(): number {
    if (!this.server) return this.port;
    const addr = this.server.address();
    return typeof addr === 'object' && addr ? addr.port : this.port;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const { pathname, query } = this.parseUrl(req.url || '/');

    // Strip basePath prefix
    let path = pathname;
    if (path.startsWith(this.basePath)) {
      path = path.slice(this.basePath.length) || '/';
    } else {
      // Not under basePath — 404
      this.send404(res, req.method || 'GET', pathname);
      return;
    }

    const method = req.method || 'GET';
    const wrapped = this.wrapResponse(res);

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = path.match(route.regex);
      if (!match) continue;

      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]!);
      });

      const parsed: ParsedRequest = { method, path, params, query, raw: req };

      try {
        await route.handler(parsed, wrapped);
      } catch (err: any) {
        logger.error('Route handler error', { path, error: err.message });
        if (!res.headersSent) {
          wrapped.status(500).json({ error: 'Internal Server Error' });
        }
      }
      return;
    }

    this.send404(res, method, path);
  }

  private parseUrl(raw: string): { pathname: string; query: Record<string, string> } {
    try {
      const parsed = new URL(raw, 'http://localhost');
      const query: Record<string, string> = {};
      parsed.searchParams.forEach((v, k) => { query[k] = v; });
      return { pathname: parsed.pathname, query };
    } catch {
      return { pathname: raw, query: {} };
    }
  }

  private wrapResponse(res: ServerResponse): WrappedResponse {
    const wrapped: WrappedResponse = {
      raw: res,
      status(code: number) {
        res.statusCode = code;
        return wrapped;
      },
      json(data: any) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      },
      text(data: string) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(data);
      },
    };
    return wrapped;
  }

  private send404(res: ServerResponse, method: string, path: string): void {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not Found',
      message: `${method} ${path} not found`,
      timestamp: new Date().toISOString(),
    }));
  }
}

import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { URL } from 'url';
import logger from '../utils/logger';

export interface Request extends IncomingMessage {
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

export interface Response extends ServerResponse {
  status: (code: number) => Response;
  json: (data: any) => void;
  send: (data: string | Buffer) => void;
}

export type RouteHandler = (req: Request, res: Response) => void | Promise<void>;

export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
  regex?: RegExp | undefined;
}

export class LightweightServer {
  private server: Server | null = null;
  private routes: Route[] = [];
  private port: number;
  private basePath: string;

  constructor(port: number = 0, basePath: string = '/actuator') {
    this.port = port;
    this.basePath = basePath;
  }

  private parseUrl(url: string): { pathname: string; query: Record<string, string> } {
    try {
      const parsed = new URL(url, `http://localhost`);
      const query: Record<string, string> = {};
      parsed.searchParams.forEach((value, key) => {
        query[key] = value;
      });
      return { pathname: parsed.pathname, query };
    } catch {
      return { pathname: url, query: {} };
    }
  }

  private matchRoute(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;

      // Simple exact match
      if (route.path === pathname) {
        return { route, params: {} };
      }

      // Pattern matching with parameters
      if (route.regex) {
        const match = pathname.match(route.regex);
        if (match) {
          const params: Record<string, string> = {};
          const paramNames = route.path.match(/:\w+/g) || [];
          paramNames.forEach((param, index) => {
            const paramName = param.slice(1); // Remove ':'
            params[paramName] = match[index + 1] || '';
          });
          return { route, params };
        }
      }
    }
    return null;
  }

  private createRouteRegex(path: string): RegExp {
    return new RegExp('^' + path.replace(/:\w+/g, '([^/]+)') + '$');
  }

  private async parseBody(req: Request): Promise<any> {
    return new Promise((resolve) => {
      if (req.method === 'GET' || req.method === 'HEAD') {
        resolve(undefined);
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          if (body && req.headers['content-type']?.includes('application/json')) {
            resolve(JSON.parse(body));
          } else {
            resolve(body || undefined);
          }
        } catch {
          resolve(body || undefined);
        }
      });
    });
  }

  private createResponse(res: ServerResponse): Response {
    const response = res as Response;
    
    response.status = (code: number) => {
      response.statusCode = code;
      return response;
    };

    response.json = (data: any) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(data));
    };

    response.send = (data: string | Buffer) => {
      response.end(data);
    };

    const originalSetHeader = res.setHeader.bind(res);
    response.setHeader = (name: string, value: string | number | string[]) => {
      originalSetHeader(name, value);
      return response;
    };

    return response;
  }

  public get(path: string, handler: RouteHandler): void {
    const route: Route = {
      method: 'GET',
      path,
      handler,
      regex: path.includes(':') ? this.createRouteRegex(path) : undefined
    };
    this.routes.push(route);
  }

  public post(path: string, handler: RouteHandler): void {
    const route: Route = {
      method: 'POST',
      path,
      handler,
      regex: path.includes(':') ? this.createRouteRegex(path) : undefined
    };
    this.routes.push(route);
  }

  public put(path: string, handler: RouteHandler): void {
    const route: Route = {
      method: 'PUT',
      path,
      handler,
      regex: path.includes(':') ? this.createRouteRegex(path) : undefined
    };
    this.routes.push(route);
  }

  public delete(path: string, handler: RouteHandler): void {
    const route: Route = {
      method: 'DELETE',
      path,
      handler,
      regex: path.includes(':') ? this.createRouteRegex(path) : undefined
    };
    this.routes.push(route);
  }

  public use(path: string, handler: RouteHandler): void {
    // Middleware support - matches all methods
    ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].forEach(method => {
      const route: Route = {
        method,
        path,
        handler,
        regex: path.includes(':') ? this.createRouteRegex(path) : undefined
      };
      this.routes.push(route);
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const { pathname, query } = this.parseUrl(req.url || '/');
    
    // Remove base path from request path
    const requestPath = pathname.startsWith(this.basePath) 
      ? pathname.slice(this.basePath.length) || '/'
      : pathname;

    const request = req as Request;
    request.url = requestPath;
    request.method = req.method || 'GET';
    request.headers = req.headers;
    request.query = query;

    const response = this.createResponse(res);

    try {
      // Parse body for non-GET requests
      request.body = await this.parseBody(request);

      // Find matching route
      const match = this.matchRoute(request.method, requestPath);
      
      if (match) {
        request.params = match.params;
        await match.route.handler(request, response);
      } else {
        // 404 handler
        response.status(404).json({ 
          error: 'Not Found', 
          message: `Route ${request.method} ${requestPath} not found`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Request handling error', { error: error instanceof Error ? error.message : 'Unknown error' });
      response.status(500).json({ 
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      });
    }
  }

  public start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, () => {
        const address = this.server?.address();
        const port = typeof address === 'object' ? address?.port : address;
        logger.info('Lightweight server started', { port, basePath: this.basePath });
        resolve(Number(port) || 0);
      });

      this.server.on('error', (error) => {
        logger.error('Server error', { error: error.message });
        reject(error);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Lightweight server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getPort(): number {
    if (!this.server) return this.port;
    const address = this.server.address();
    if (typeof address === 'object' && address?.port) {
      return address.port;
    }
    if (typeof address === 'object' && address?.port) {
      return address.port;
    }
    return typeof address === 'string' ? 0 : 0;
  }
}

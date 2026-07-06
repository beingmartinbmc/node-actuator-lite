import { NodeActuator } from '../core/Actuator';
import type { ActuatorOptions } from '../core/types';
import { readJsonBody } from '../utils/readJsonBody';

type HttpHandler = (req: any, res: any, next?: (err?: any) => void) => void;

/**
 * Strict base-path check: returns true when `url` is exactly `base` or starts
 * with `base` followed by '/' or '?'. Prevents '/actuator' matching '/actuatorish'.
 */
function isUnderBasePath(url: string, base: string): boolean {
  if (!url.startsWith(base)) return false;
  const next = url[base.length];
  return next === undefined || next === '/' || next === '?';
}

export interface ActuatorHttpResult {
  /**
   * A `(req, res)` handler usable directly with `http.createServer(handler)`
   * or as connect-style middleware. When a `next` callback is provided and the
   * request is not under `basePath`, it is invoked so the handler can be chained.
   */
  handler: HttpHandler;
  /** The underlying actuator instance for programmatic access */
  actuator: NodeActuator;
}

/**
 * Adapter for the built-in `node:http` module (and any connect-style stack).
 *
 * Usage (standalone server):
 *   import http from 'node:http';
 *   import { actuatorHttp } from 'node-actuator-lite/middleware/http';
 *
 *   const { handler, actuator } = actuatorHttp({ prometheus: { defaultMetrics: true } });
 *   http.createServer(handler).listen(8080);
 *
 * Usage (as middleware, chaining to your own router):
 *   const { handler } = actuatorHttp();
 *   server.on('request', (req, res) => handler(req, res, () => myRouter(req, res)));
 */
export function actuatorHttp(options: ActuatorOptions = {}): ActuatorHttpResult {
  const opts: ActuatorOptions = { ...options, serverless: true };
  const actuator = new NodeActuator(opts);
  const basePath = opts.basePath ?? '/actuator';

  const handler: HttpHandler = (req: any, res: any, next?: (err?: any) => void) => {
    void dispatch(req, res, next);
  };

  async function dispatch(req: any, res: any, next?: (err?: any) => void): Promise<void> {
    const rawUrl: string = req.url || '';
    const method: string = (req.method || 'GET').toUpperCase();

    // Use the URL constructor for robust pathname/query parsing.
    let pathname: string;
    let query: Record<string, string>;
    try {
      const parsed = new URL(rawUrl, 'http://localhost');
      pathname = parsed.pathname;
      query = {};
      parsed.searchParams.forEach((v, k) => { query[k] = v; });
    } catch {
      pathname = rawUrl.split('?')[0] || '/';
      query = {};
    }

    if (!isUnderBasePath(pathname, basePath)) {
      if (next) return next();
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const subPath = pathname.slice(basePath.length) || '/';
    const body = await readJsonBody(req, method);

    try {
      const result = await actuator.dispatch({
        method,
        subPath,
        query,
        params: {},
        body,
        raw: req,
      });

      if (!result) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      // Operational endpoints must not be cached.
      res.statusCode = result.status;
      res.setHeader('Cache-Control', 'no-store');
      if (result.contentType === 'text') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(String(result.body));
        return;
      }
      if (result.contentType === 'html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(String(result.body));
        return;
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(result.body));
    } catch {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  return { handler, actuator };
}

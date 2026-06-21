import { NodeActuator } from '../core/Actuator';
import type { ActuatorOptions } from '../core/types';

type HttpHandler = (req: any, res: any, next?: (err?: any) => void) => void;

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
    const [pathname = '', queryString = ''] = rawUrl.split('?');

    if (!pathname.startsWith(basePath)) {
      if (next) return next();
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const subPath = pathname.slice(basePath.length) || '/';
    const query = parseQuery(queryString);

    try {
      const result = await actuator.dispatch({
        method,
        subPath,
        query,
        params: {},
        body: undefined,
        raw: req,
      });

      if (!result) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      res.statusCode = result.status;
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

function parseQuery(queryString: string): Record<string, string> {
  const query: Record<string, string> = {};
  if (!queryString) return query;
  for (const pair of queryString.split('&')) {
    if (!pair) continue;
    const idx = pair.indexOf('=');
    if (idx === -1) {
      query[decodeURIComponent(pair)] = '';
    } else {
      query[decodeURIComponent(pair.slice(0, idx))] = decodeURIComponent(pair.slice(idx + 1));
    }
  }
  return query;
}

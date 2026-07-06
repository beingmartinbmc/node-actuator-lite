import { NodeActuator } from '../core/Actuator';
import type { ActuatorOptions } from '../core/types';

type ExpressMiddleware = (req: any, res: any, next: any) => void;

/**
 * Strict base-path check: returns true when `url` is exactly `base` or starts
 * with `base` followed by '/' or '?'. Prevents '/actuator' matching '/actuatorish'.
 */
function isUnderBasePath(url: string, base: string): boolean {
  if (!url.startsWith(base)) return false;
  const next = url[base.length];
  return next === undefined || next === '/' || next === '?';
}

export interface ActuatorMiddlewareResult {
  /** Mount this on your Express app: `app.use(result.handler)` */
  handler: ExpressMiddleware;
  /** The underlying actuator instance for programmatic access */
  actuator: NodeActuator;
}

/**
 * Express/Connect-compatible middleware.
 *
 * Usage:
 *   import express from 'express';
 *   import { actuatorMiddleware } from 'node-actuator-lite/middleware/express';
 *
 *   const app = express();
 *   const { handler, actuator } = actuatorMiddleware({ prometheus: { defaultMetrics: true } });
 *   app.use(handler);
 *
 *   // Access actuator programmatically:
 *   actuator.prometheus.metric('my_counter')!.inc();
 */
export function actuatorMiddleware(options: ActuatorOptions = {}): ActuatorMiddlewareResult {
  const opts: ActuatorOptions = { ...options, serverless: true };
  const actuator = new NodeActuator(opts);
  const basePath = opts.basePath ?? '/actuator';

  const handler: ExpressMiddleware = async (req: any, res: any, next: any) => {
    const url: string = req.originalUrl || req.url || '';
    const method: string = (req.method || 'GET').toUpperCase();

    // Strict prefix match: url must be exactly basePath or basePath followed by
    // '/' or '?'. This prevents '/actuator' matching '/actuatorish'.
    if (!isUnderBasePath(url, basePath)) return next();

    const subPath = url.slice(basePath.length).split('?')[0] || '/';
    const query: Record<string, string> = req.query || {};

    try {
      const result = await actuator.dispatch({
        method,
        subPath,
        query,
        params: {},
        body: req.body,
        raw: req,
      });

      if (!result) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Operational endpoints must not be cached.
      res.set('Cache-Control', 'no-store');

      if (result.contentType === 'text') {
        res.set('Content-Type', 'text/plain; charset=utf-8');
        return res.status(result.status).send(String(result.body));
      }
      if (result.contentType === 'html') {
        res.set('Content-Type', 'text/html; charset=utf-8');
        return res.status(result.status).send(String(result.body));
      }
      return res.status(result.status).json(result.body);
    } catch (err: any) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  return { handler, actuator };
}

import { NodeActuator } from '../core/Actuator';
import type { ActuatorOptions } from '../core/types';

type KoaMiddleware = (ctx: any, next: () => Promise<any>) => Promise<void>;

export interface ActuatorKoaResult {
  /** Mount this on your Koa app: `app.use(result.middleware)` */
  middleware: KoaMiddleware;
  /** The underlying actuator instance for programmatic access */
  actuator: NodeActuator;
}

/**
 * Koa-compatible middleware.
 *
 * Usage:
 *   import Koa from 'koa';
 *   import { actuatorKoa } from 'node-actuator-lite/middleware/koa';
 *
 *   const app = new Koa();
 *   const { middleware, actuator } = actuatorKoa({ prometheus: { defaultMetrics: true } });
 *   app.use(middleware);
 *
 *   // Access actuator programmatically:
 *   actuator.prometheus.metric('my_counter')!.inc();
 */
export function actuatorKoa(options: ActuatorOptions = {}): ActuatorKoaResult {
  const opts: ActuatorOptions = { ...options, serverless: true };
  const actuator = new NodeActuator(opts);
  const basePath = opts.basePath ?? '/actuator';

  const middleware: KoaMiddleware = async (ctx: any, next: () => Promise<any>) => {
    const url: string = ctx.originalUrl || ctx.url || ctx.path || '';
    const method: string = (ctx.method || 'GET').toUpperCase();

    if (!url.startsWith(basePath)) return next();

    const subPath = url.slice(basePath.length).split('?')[0] || '/';
    const query: Record<string, string> = ctx.query || {};

    try {
      const result = await actuator.dispatch({
        method,
        subPath,
        query,
        params: {},
        body: ctx.request ? ctx.request.body : undefined,
        raw: ctx.req,
      });

      if (!result) {
        ctx.status = 404;
        ctx.body = { error: 'Not found' };
        return;
      }

      ctx.status = result.status;
      if (result.contentType === 'text') {
        ctx.type = 'text/plain; charset=utf-8';
        ctx.body = String(result.body);
        return;
      }
      if (result.contentType === 'html') {
        ctx.type = 'text/html; charset=utf-8';
        ctx.body = String(result.body);
        return;
      }
      ctx.body = result.body;
    } catch {
      ctx.status = 500;
      ctx.body = { error: 'Internal Server Error' };
    }
  };

  return { middleware, actuator };
}

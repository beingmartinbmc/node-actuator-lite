import { NodeActuator } from '../core/Actuator';
import type { ActuatorOptions } from '../core/types';

type ExpressMiddleware = (req: any, res: any, next: any) => void;

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

    if (!url.startsWith(basePath)) return next();

    const subPath = url.slice(basePath.length).split('?')[0] || '';
    const query = req.query || {};

    try {
      // Discovery
      if (subPath === '' || subPath === '/') {
        return res.json(actuator.discovery());
      }

      // Health
      if (subPath === '/health' && method === 'GET') {
        const result = await actuator.getHealth(query.showDetails);
        return res.status(result.status === 'UP' ? 200 : 503).json(result);
      }

      const healthMatch = subPath.match(/^\/health\/(.+)$/);
      if (healthMatch && method === 'GET') {
        const name = decodeURIComponent(healthMatch[1]!);
        const group = await actuator.getHealthGroup(name);
        if (group) return res.status(group.status === 'UP' ? 200 : 503).json(group);
        const comp = await actuator.getHealthComponent(name);
        if (comp) return res.status(comp.status === 'UP' ? 200 : 503).json(comp);
        return res.status(404).json({ error: `Health component '${name}' not found` });
      }

      // Environment
      if (subPath === '/env' && method === 'GET') {
        return res.json(actuator.getEnv());
      }

      const envMatch = subPath.match(/^\/env\/(.+)$/);
      if (envMatch && method === 'GET') {
        const name = decodeURIComponent(envMatch[1]!);
        const v = actuator.getEnvVariable(name);
        return v ? res.json(v) : res.status(404).json({ error: `Variable '${name}' not found` });
      }

      // Thread dump
      if (subPath === '/threaddump' && method === 'GET') {
        return res.json(actuator.getThreadDump());
      }

      // Heap dump
      if (subPath === '/heapdump' && method === 'POST') {
        return res.json(await actuator.getHeapDump());
      }

      // Prometheus
      if (subPath === '/prometheus' && method === 'GET') {
        res.set('Content-Type', 'text/plain; charset=utf-8');
        return res.send(await actuator.getPrometheus());
      }

      // Unknown actuator sub-path
      return res.status(404).json({ error: 'Not found' });
    } catch (err: any) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  return { handler, actuator };
}

import { NodeActuator } from '../core/Actuator';
import type { ActuatorOptions } from '../core/types';

export interface ActuatorPluginOptions extends ActuatorOptions {}

/**
 * Fastify plugin for node-actuator-lite.
 *
 * Usage:
 *   import Fastify from 'fastify';
 *   import { actuatorPlugin } from 'node-actuator-lite/middleware/fastify';
 *
 *   const app = Fastify();
 *   await app.register(actuatorPlugin, { prometheus: { defaultMetrics: true } });
 *   // All /actuator/* routes are now registered.
 *   // Access the actuator instance: app.actuator
 */
export async function actuatorPlugin(
  fastify: any,
  options: ActuatorPluginOptions = {},
): Promise<void> {
  const opts: ActuatorOptions = { ...options, serverless: true };
  const actuator = new NodeActuator(opts);
  const basePath = opts.basePath ?? '/actuator';
  const enabled = {
    health: opts.health?.enabled ?? true,
    env: opts.env?.enabled ?? true,
    threadDump: opts.threadDump?.enabled ?? true,
    heapDump: opts.heapDump?.enabled ?? true,
    prometheus: opts.prometheus?.enabled ?? true,
    info: opts.info?.enabled ?? true,
    metrics: opts.metrics?.enabled ?? true,
  };

  // Decorate fastify instance so users can access the actuator
  if (!fastify.hasDecorator('actuator')) {
    fastify.decorate('actuator', actuator);
  }

  // Discovery
  fastify.get(basePath, async () => actuator.discovery());

  // Health
  if (enabled.health) {
    fastify.get(`${basePath}/health`, async (req: any, reply: any) => {
      const result = await actuator.getHealth(req.query?.showDetails);
      reply.code(result.status === 'UP' ? 200 : 503).send(result);
    });

    fastify.get(`${basePath}/health/:name`, async (req: any, reply: any) => {
      const name: string = (req.params as any).name;
      const group = await actuator.getHealthGroup(name);
      if (group) return reply.code(group.status === 'UP' ? 200 : 503).send(group);
      const comp = await actuator.getHealthComponent(name);
      if (comp) return reply.code(comp.status === 'UP' ? 200 : 503).send(comp);
      reply.code(404).send({ error: `Health component '${name}' not found` });
    });
  }

  // Environment
  if (enabled.env) {
    fastify.get(`${basePath}/env`, async () => actuator.getEnv());

    fastify.get(`${basePath}/env/:name`, async (req: any, reply: any) => {
      const name: string = (req.params as any).name;
      const v = actuator.getEnvVariable(name);
      if (!v) return reply.code(404).send({ error: `Variable '${name}' not found` });
      return v;
    });
  }

  // Thread dump
  if (enabled.threadDump) {
    fastify.get(`${basePath}/threaddump`, async () => actuator.getThreadDump());
  }

  // Heap dump
  if (enabled.heapDump) {
    fastify.post(`${basePath}/heapdump`, async () => actuator.getHeapDump());
  }

  // Prometheus
  if (enabled.prometheus) {
    fastify.get(`${basePath}/prometheus`, async (_req: any, reply: any) => {
      reply.type('text/plain; charset=utf-8').send(await actuator.getPrometheus());
    });
  }

  if (enabled.info) {
    fastify.get(`${basePath}/info`, async () => actuator.getInfoAsync());
  }

  if (enabled.metrics) {
    fastify.get(`${basePath}/metrics`, async () => actuator.getMetrics());
  }

  // Custom endpoints — including any registered globally via
  // `registerEndpoint(...)` before the plugin was registered (e.g. by
  // `node-eventloop-watchdog` when both packages are wired together).
  // Each is mounted as a Fastify route under `${basePath}/${id}` so the
  // discovery output, the request router, and the actuator's
  // `invokeEndpoint` lookup all stay in sync.
  for (const endpoint of (actuator as any).customEndpoints.values()) {
    const method = endpoint.method as 'GET' | 'POST';
    const route = `${basePath}/${endpoint.id}`;
    const handler = async (req: any, reply: any) => {
      const result = await endpoint.handler({
        method,
        path: `/${endpoint.id}`,
        query: req.query,
        raw: req.raw,
      });
      if (endpoint.contentType === 'text') {
        reply.type('text/plain; charset=utf-8').send(String(result));
        return;
      }
      reply.send(result);
    };
    if (method === 'POST') {
      fastify.post(route, handler);
    } else {
      fastify.get(route, handler);
    }
  }
}

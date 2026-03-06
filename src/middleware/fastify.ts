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

  // Decorate fastify instance so users can access the actuator
  if (!fastify.hasDecorator('actuator')) {
    fastify.decorate('actuator', actuator);
  }

  // Discovery
  fastify.get(basePath, async () => actuator.discovery());

  // Health
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

  // Environment
  fastify.get(`${basePath}/env`, async () => actuator.getEnv());

  fastify.get(`${basePath}/env/:name`, async (req: any, reply: any) => {
    const name: string = (req.params as any).name;
    const v = actuator.getEnvVariable(name);
    if (!v) return reply.code(404).send({ error: `Variable '${name}' not found` });
    return v;
  });

  // Thread dump
  fastify.get(`${basePath}/threaddump`, async () => actuator.getThreadDump());

  // Heap dump
  fastify.post(`${basePath}/heapdump`, async () => actuator.getHeapDump());

  // Prometheus
  fastify.get(`${basePath}/prometheus`, async (_req: any, reply: any) => {
    reply.type('text/plain; charset=utf-8').send(await actuator.getPrometheus());
  });
}

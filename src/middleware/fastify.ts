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

  // Register every endpoint from the shared table (built-in + custom, including
  // ecosystem-registered global endpoints). Auth and content-type handling are
  // delegated to the actuator's shared dispatch so all transports stay in sync.
  for (const descriptor of actuator.listEndpoints()) {
    // '/' is the discovery root → mount at basePath itself.
    const route = descriptor.path === '/' ? basePath : `${basePath}${descriptor.path}`;

    const handler = async (req: any, reply: any) => {
      const params: Record<string, string> = (req && req.params) || {};
      const query: Record<string, string> = (req && req.query) || {};
      const result = await actuator.runDescriptor(descriptor, {
        method: descriptor.method,
        subPath: descriptor.path,
        query,
        params,
        body: req && req.body,
        raw: req && req.raw,
      });

      // Text payloads (e.g. Prometheus) need an explicit content type.
      if (result.contentType === 'text') {
        return reply.type('text/plain; charset=utf-8').code(result.status).send(String(result.body));
      }
      // HTML payloads (e.g. dashboard).
      if (result.contentType === 'html') {
        return reply.type('text/html; charset=utf-8').code(result.status).send(String(result.body));
      }
      // Non-200 statuses must be set on the reply.
      if (result.status !== 200) {
        return reply.code(result.status).send(result.body);
      }
      // 200 JSON: return the body directly (idiomatic Fastify) so simple
      // handlers work even without a reply object.
      return result.body;
    };

    if (descriptor.method === 'POST') {
      fastify.post(route, handler);
    } else {
      fastify.get(route, handler);
    }
  }
}

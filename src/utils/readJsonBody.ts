import type { IncomingMessage } from 'http';

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

// ponytail: 1MB is generous for actuator payloads (e.g. { configuredLevel }) while
// bounding memory use against a malicious/oversized request body.
const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Reads and JSON-parses a request body for raw `node:http` requests (the
 * standalone server and the `http`/connect adapter have no framework body
 * parser to rely on, unlike Express/Fastify/Koa).
 *
 * Returns `undefined` for methods that don't carry a body, empty bodies,
 * oversized bodies, or invalid JSON — callers should treat that as "no body".
 */
export function readJsonBody(req: IncomingMessage, method: string): Promise<unknown> {
  if (!BODY_METHODS.has(method.toUpperCase())) return Promise.resolve(undefined);

  return new Promise((resolve) => {
    let data = '';
    let size = 0;
    let settled = false;

    const finish = (value: unknown): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        finish(undefined);
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return finish(undefined);
      try {
        finish(JSON.parse(data));
      } catch {
        finish(undefined);
      }
    });
    req.on('error', () => finish(undefined));
  });
}

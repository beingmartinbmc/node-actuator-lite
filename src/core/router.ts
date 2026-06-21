// ============================================================================
// Shared endpoint routing / dispatch
//
// A single source of truth for the actuator's endpoints. The standalone HTTP
// server, the Express middleware, and the Fastify plugin all consume the same
// endpoint descriptors so behaviour (status codes, content types, auth) can
// never drift between transports.
// ============================================================================

export type ActuatorContentType = 'json' | 'text' | 'html';

/** Normalised request passed to every endpoint handler, transport-agnostic. */
export interface ActuatorRequestContext {
  method: string;
  /** Path under the configured basePath, e.g. '/health' or '/'. */
  subPath: string;
  query: Record<string, string>;
  params: Record<string, string>;
  /** Parsed request body (POST/PUT/PATCH), if any. */
  body?: unknown;
  /** Underlying transport request object (IncomingMessage / Express / Fastify). */
  raw?: unknown;
}

/** Normalised result returned by every endpoint handler. */
export interface ActuatorRouteResult {
  status: number;
  contentType: ActuatorContentType;
  body: unknown;
}

export interface EndpointDescriptor {
  method: 'GET' | 'POST';
  /** Path under basePath, e.g. '/health' or '/health/:name'. '/' is the discovery root. */
  path: string;
  handle(
    ctx: ActuatorRequestContext,
  ): Promise<ActuatorRouteResult> | ActuatorRouteResult;
}

/**
 * Authorization callback. Return `true` to allow the request, `false` to reject
 * it with `401 Unauthorized`. Throwing is treated as a rejection.
 */
export type AuthFn = (
  ctx: ActuatorRequestContext,
) => boolean | Promise<boolean>;

export function json(body: unknown, status = 200): ActuatorRouteResult {
  return { status, contentType: 'json', body };
}

export function text(body: string, status = 200): ActuatorRouteResult {
  return { status, contentType: 'text', body };
}

export function html(body: string, status = 200): ActuatorRouteResult {
  return { status, contentType: 'html', body };
}

/** Spring-style mapping: UP → 200, anything else → 503. */
export function healthStatusCode(status: string): number {
  return status === 'UP' ? 200 : 503;
}

/** Compile a descriptor path containing `:param` segments into a matcher. */
export function compilePath(path: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const regexStr = path.replace(/:([^/]+)/g, (_m, name: string) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${regexStr}$`), paramNames };
}

/**
 * Run the auth check (if configured) then the endpoint handler. Returns a
 * `401` result when auth fails so every transport rejects consistently.
 */
export async function runEndpoint(
  descriptor: EndpointDescriptor,
  ctx: ActuatorRequestContext,
  auth?: AuthFn,
): Promise<ActuatorRouteResult> {
  if (auth) {
    let allowed = false;
    try {
      allowed = await auth(ctx);
    } catch {
      allowed = false;
    }
    if (!allowed) {
      return json({ error: 'Unauthorized' }, 401);
    }
  }
  return descriptor.handle(ctx);
}

import { actuatorKoa } from '../src/middleware/koa';
import { actuatorHttp } from '../src/middleware/http';

// ===========================================================================
// Koa adapter
// ===========================================================================

describe('actuatorKoa', () => {
  function createCtx(url: string, method = 'GET') {
    return {
      originalUrl: url,
      url,
      method,
      query: {},
      request: {},
      req: {},
      status: 404,
      type: undefined as string | undefined,
      body: undefined as unknown,
    };
  }

  test('passes non-actuator requests to next', async () => {
    const { middleware } = actuatorKoa({ prometheus: { defaultMetrics: false } });
    const ctx = createCtx('/api/users');
    const next = jest.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('serves discovery JSON at base path', async () => {
    const { middleware } = actuatorKoa({ prometheus: { defaultMetrics: false } });
    const ctx = createCtx('/actuator');
    const next = jest.fn();

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.status).toBe(200);
    expect((ctx.body as any)._links).toBeDefined();
  });

  test('serves info endpoint as JSON', async () => {
    const { middleware } = actuatorKoa({ prometheus: { defaultMetrics: false } });
    const ctx = createCtx('/actuator/info');

    await middleware(ctx, jest.fn());

    expect(ctx.status).toBe(200);
    expect((ctx.body as any).runtime.nodeVersion).toBe(process.version);
  });

  test('serves prometheus endpoint as text', async () => {
    const { middleware } = actuatorKoa({ prometheus: { defaultMetrics: false } });
    const ctx = createCtx('/actuator/prometheus');

    await middleware(ctx, jest.fn());

    expect(ctx.type).toContain('text/plain');
    expect(typeof ctx.body).toBe('string');
  });

  test('serves dashboard as HTML', async () => {
    const { middleware } = actuatorKoa({ prometheus: { defaultMetrics: false } });
    const ctx = createCtx('/actuator/dashboard');

    await middleware(ctx, jest.fn());

    expect(ctx.status).toBe(200);
    expect(ctx.type).toContain('text/html');
    expect(String(ctx.body)).toContain('Actuator Dashboard');
  });

  test('returns 404 for unknown actuator path', async () => {
    const { middleware } = actuatorKoa({ prometheus: { defaultMetrics: false } });
    const ctx = createCtx('/actuator/__nope__');

    await middleware(ctx, jest.fn());

    expect(ctx.status).toBe(404);
  });

  test('exposes actuator instance', () => {
    const { actuator } = actuatorKoa({ prometheus: { defaultMetrics: false } });
    expect(actuator).toBeDefined();
    expect(typeof actuator.dispatch).toBe('function');
  });

  test('returns 500 when an endpoint handler throws', async () => {
    const { middleware } = actuatorKoa({
      prometheus: { defaultMetrics: false },
      endpoints: [{ id: 'boom', handler: () => { throw new Error('kapow'); } }],
    });
    const ctx = createCtx('/actuator/boom');

    await middleware(ctx, jest.fn());

    expect(ctx.status).toBe(500);
    expect(ctx.body).toEqual({ error: 'Internal Server Error' });
  });

  test('falls back across ctx url fields and missing query/request', async () => {
    const { middleware } = actuatorKoa({ prometheus: { defaultMetrics: false } });
    // Only `path` present (no originalUrl/url); no query; no request object.
    const ctx: any = { path: '/actuator/info', method: 'get', req: {}, status: 404 };

    await middleware(ctx, jest.fn());

    expect(ctx.status).toBe(200);
    expect(ctx.body.runtime.nodeVersion).toBe(process.version);
  });

  test('uses ctx.url when originalUrl absent and defaults method', async () => {
    const { middleware } = actuatorKoa({ prometheus: { defaultMetrics: false } });
    // No originalUrl (url middle branch), no method (defaults to GET), no req.
    const ctx: any = { url: '/actuator/info', query: {}, request: { body: {} }, status: 404 };

    await middleware(ctx, jest.fn());

    expect(ctx.status).toBe(200);
    expect(ctx.body.runtime.nodeVersion).toBe(process.version);
  });

  test('passes through when ctx has no url fields at all', async () => {
    const { middleware } = actuatorKoa({ prometheus: { defaultMetrics: false } });
    const ctx: any = { method: 'GET', status: 404 };
    const next = jest.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});


// ===========================================================================
// node:http adapter
// ===========================================================================

describe('actuatorHttp', () => {
  function createRes() {
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      ended: false,
    };
    res.setHeader = jest.fn((k: string, v: string) => { res.headers[k] = v; });
    res.end = jest.fn((data?: unknown) => { res.body = data; res.ended = true; });
    return res;
  }

  async function call(url: string, method = 'GET', next?: jest.Mock) {
    const { handler } = actuatorHttp({ prometheus: { defaultMetrics: false } });
    const req = { url, method };
    const res = createRes();
    handler(req, res, next);
    // handler dispatches asynchronously; wait a tick for the promise chain.
    await new Promise((r) => setImmediate(r));
    return res;
  }

  test('serves discovery JSON', async () => {
    const res = await call('/actuator');
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('application/json');
    expect(JSON.parse(res.body)._links).toBeDefined();
  });

  test('serves info endpoint as JSON', async () => {
    const res = await call('/actuator/info');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).runtime.nodeVersion).toBe(process.version);
  });

  test('serves prometheus endpoint as text', async () => {
    const res = await call('/actuator/prometheus');
    expect(res.headers['Content-Type']).toContain('text/plain');
    expect(typeof res.body).toBe('string');
  });

  test('serves dashboard as HTML', async () => {
    const res = await call('/actuator/dashboard');
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/html');
    expect(String(res.body)).toContain('Actuator Dashboard');
  });

  test('parses query string params', async () => {
    const { handler } = actuatorHttp({ prometheus: { defaultMetrics: false } });
    const req = { url: '/actuator/health?showDetails=never', method: 'GET' };
    const res = createRes();
    handler(req, res);
    await new Promise((r) => setImmediate(r));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBeDefined();
  });

  test('calls next for non-actuator paths when provided', async () => {
    const next = jest.fn();
    await call('/api/users', 'GET', next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('returns 404 JSON for non-actuator paths without next', async () => {
    const res = await call('/api/users');
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not found' });
  });

  test('returns 404 for unknown actuator path', async () => {
    const res = await call('/actuator/__nope__');
    expect(res.statusCode).toBe(404);
  });

  test('exposes actuator instance', () => {
    const { actuator } = actuatorHttp({ prometheus: { defaultMetrics: false } });
    expect(actuator).toBeDefined();
    expect(typeof actuator.dispatch).toBe('function');
  });

  test('returns 500 when an endpoint handler throws', async () => {
    const { handler } = actuatorHttp({
      prometheus: { defaultMetrics: false },
      endpoints: [{ id: 'boom', handler: () => { throw new Error('kapow'); } }],
    });
    const req = { url: '/actuator/boom', method: 'GET' };
    const res = createRes();
    handler(req, res);
    await new Promise((r) => setImmediate(r));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'Internal Server Error' });
  });

  test('parses valueless and empty query params', async () => {
    const { handler } = actuatorHttp({ prometheus: { defaultMetrics: false } });
    // Trailing '&', a bare key with no '=', and an empty segment exercise the parser branches.
    const req = { url: '/actuator/health?showDetails&foo=&', method: 'GET' };
    const res = createRes();
    handler(req, res);
    await new Promise((r) => setImmediate(r));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBeDefined();
  });

  test('defaults method to GET when req.method missing', async () => {
    const { handler } = actuatorHttp({ prometheus: { defaultMetrics: false } });
    const req = { url: '/actuator/info' };
    const res = createRes();
    handler(req, res);
    await new Promise((r) => setImmediate(r));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).runtime.nodeVersion).toBe(process.version);
  });

  test('handles missing req.url by passing through to next', async () => {
    const { handler } = actuatorHttp({ prometheus: { defaultMetrics: false } });
    const next = jest.fn();
    const res = createRes();
    handler({}, res, next);
    await new Promise((r) => setImmediate(r));
    expect(next).toHaveBeenCalledTimes(1);
  });
});


import { actuatorMiddleware, actuatorPlugin, invokeEndpoint, registerEndpoint } from '../src';

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
  };

  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.send = jest.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.set = jest.fn((name: string, value: string) => {
    res.headers[name] = value;
    return res;
  });

  return res;
}

describe('actuatorMiddleware', () => {
  async function callHandler(url: string, method = 'GET') {
    const { handler } = actuatorMiddleware({
      health: { enabled: false },
      env: { enabled: false },
      threadDump: { enabled: false },
      heapDump: { enabled: false },
      prometheus: { enabled: false, defaultMetrics: false },
      info: { enabled: false },
      metrics: { enabled: false },
    });
    const req = { originalUrl: url, url, method, query: {} };
    const res = createMockResponse();
    const next = jest.fn();

    await Promise.resolve(handler(req, res, next));

    return { res, next };
  }

  test('passes non-actuator requests to next middleware', async () => {
    const { res, next } = await callHandler('/api/users');

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).not.toHaveBeenCalled();
  });

  test('discovery only lists enabled endpoints', async () => {
    const { res, next } = await callHandler('/actuator');

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ _links: { self: { href: '/actuator' } } });
  });

  test.each([
    ['GET', '/actuator/health'],
    ['GET', '/actuator/health/process'],
    ['GET', '/actuator/env'],
    ['GET', '/actuator/env/NODE_ENV'],
    ['GET', '/actuator/threaddump'],
    ['POST', '/actuator/heapdump'],
    ['GET', '/actuator/prometheus'],
    ['GET', '/actuator/info'],
    ['GET', '/actuator/metrics'],
  ])('returns 404 for disabled %s %s', async (method, url) => {
    const { res, next } = await callHandler(url, method);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  test('serves registered custom endpoint', async () => {
    const { handler } = actuatorMiddleware({
      prometheus: { defaultMetrics: false },
      endpoints: [
        { id: 'dependencies', handler: () => ({ redis: 'UP' }) },
      ],
    });
    const req = { originalUrl: '/actuator/dependencies', url: '/actuator/dependencies', method: 'GET', query: {} };
    const res = createMockResponse();
    const next = jest.fn();

    await Promise.resolve(handler(req, res, next));

    expect(next).not.toHaveBeenCalled();
    expect(res.body).toEqual({ redis: 'UP' });
  });

  test('serves enabled info and metrics endpoints', async () => {
    const { handler } = actuatorMiddleware({ prometheus: { defaultMetrics: false } });
    const next = jest.fn();

    const infoRes = createMockResponse();
    await Promise.resolve(handler(
      { originalUrl: '/actuator/info', url: '/actuator/info', method: 'GET', query: {} },
      infoRes,
      next,
    ));
    expect(infoRes.body.runtime.nodeVersion).toBe(process.version);

    const metricsRes = createMockResponse();
    await Promise.resolve(handler(
      { originalUrl: '/actuator/metrics', url: '/actuator/metrics', method: 'GET', query: {} },
      metricsRes,
      next,
    ));
    expect(metricsRes.body.process.memory.heapUsed).toBeGreaterThan(0);
  });

  test('serves health, env, threaddump, and prometheus paths', async () => {
    const { handler } = actuatorMiddleware({ prometheus: { defaultMetrics: false } });
    const next = jest.fn();

    const healthRes = createMockResponse();
    await Promise.resolve(handler(
      { originalUrl: '/actuator/health?showDetails=never', url: '/actuator/health?showDetails=never', method: 'GET', query: { showDetails: 'never' } },
      healthRes,
      next,
    ));
    expect(healthRes.body.status).toBeDefined();

    process.env['__MIDDLEWARE_TEST_VAR__'] = 'value';
    const envRes = createMockResponse();
    await Promise.resolve(handler(
      { originalUrl: '/actuator/env/__MIDDLEWARE_TEST_VAR__', url: '/actuator/env/__MIDDLEWARE_TEST_VAR__', method: 'GET', query: {} },
      envRes,
      next,
    ));
    expect(envRes.body.value).toBe('value');
    delete process.env['__MIDDLEWARE_TEST_VAR__'];

    const threadRes = createMockResponse();
    await Promise.resolve(handler(
      { originalUrl: '/actuator/threaddump', url: '/actuator/threaddump', method: 'GET', query: {} },
      threadRes,
      next,
    ));
    expect(threadRes.body.pid).toBe(process.pid);

    const promRes = createMockResponse();
    await Promise.resolve(handler(
      { originalUrl: '/actuator/prometheus', url: '/actuator/prometheus', method: 'GET', query: {} },
      promRes,
      next,
    ));
    expect(promRes.headers['Content-Type']).toContain('text/plain');
    expect(typeof promRes.body).toBe('string');
  });

  test('returns 500 when endpoint handler throws', async () => {
    const { handler } = actuatorMiddleware({
      prometheus: { defaultMetrics: false },
      endpoints: [
        { id: 'broken', handler: () => { throw new Error('boom'); } },
      ],
    });
    const res = createMockResponse();

    await Promise.resolve(handler(
      { originalUrl: '/actuator/broken', url: '/actuator/broken', method: 'GET', query: {} },
      res,
      jest.fn(),
    ));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
  });
});

describe('actuatorPlugin', () => {
  function createFastifyMock() {
    const routes: Array<{ method: string; path: string }> = [];
    const fastify: any = {
      routes,
      hasDecorator: jest.fn(() => false),
      decorate: jest.fn(),
      get: jest.fn((path: string) => {
        routes.push({ method: 'GET', path });
      }),
      post: jest.fn((path: string) => {
        routes.push({ method: 'POST', path });
      }),
    };

    return fastify;
  }

  test('registers only discovery when every feature is disabled', async () => {
    const fastify = createFastifyMock();

    await actuatorPlugin(fastify, {
      health: { enabled: false },
      env: { enabled: false },
      threadDump: { enabled: false },
      heapDump: { enabled: false },
      prometheus: { enabled: false, defaultMetrics: false },
      info: { enabled: false },
      metrics: { enabled: false },
    });

    expect(fastify.routes).toEqual([{ method: 'GET', path: '/actuator' }]);
    expect(fastify.decorate).toHaveBeenCalledWith('actuator', expect.any(Object));
  });

  test('registers all default routes when features are enabled', async () => {
    const fastify = createFastifyMock();

    await actuatorPlugin(fastify, { prometheus: { defaultMetrics: false } });

    expect(fastify.routes).toEqual(expect.arrayContaining([
      { method: 'GET', path: '/actuator' },
      { method: 'GET', path: '/actuator/health' },
      { method: 'GET', path: '/actuator/health/:name' },
      { method: 'GET', path: '/actuator/env' },
      { method: 'GET', path: '/actuator/env/:name' },
      { method: 'GET', path: '/actuator/threaddump' },
      { method: 'POST', path: '/actuator/heapdump' },
      { method: 'GET', path: '/actuator/prometheus' },
      { method: 'GET', path: '/actuator/info' },
      { method: 'GET', path: '/actuator/metrics' },
    ]));
  });

  test('registered Fastify route handlers return expected payloads', async () => {
    const handlers: Record<string, Function> = {};
    const fastify: any = {
      hasDecorator: jest.fn(() => false),
      decorate: jest.fn(),
      get: jest.fn((path: string, handler: Function) => {
        handlers[`GET ${path}`] = handler;
      }),
      post: jest.fn((path: string, handler: Function) => {
        handlers[`POST ${path}`] = handler;
      }),
    };

    await actuatorPlugin(fastify, { prometheus: { defaultMetrics: false } });

    await expect(handlers['GET /actuator']!()).resolves.toHaveProperty('_links');
    await expect(handlers['GET /actuator/info']!()).resolves.toHaveProperty('runtime');
    await expect(handlers['GET /actuator/metrics']!()).resolves.toHaveProperty('process');
    await expect(handlers['GET /actuator/env']!()).resolves.toHaveProperty('propertySources');
    await expect(handlers['GET /actuator/threaddump']!()).resolves.toHaveProperty('pid', process.pid);
  });

  test('Fastify route handlers set reply status and content type branches', async () => {
    const handlers: Record<string, Function> = {};
    const fastify: any = {
      hasDecorator: jest.fn(() => true),
      decorate: jest.fn(),
      get: jest.fn((path: string, handler: Function) => {
        handlers[`GET ${path}`] = handler;
      }),
      post: jest.fn((path: string, handler: Function) => {
        handlers[`POST ${path}`] = handler;
      }),
    };

    await actuatorPlugin(fastify, {
      prometheus: { defaultMetrics: false },
      health: {
        custom: [
          { name: 'downSvc', check: async () => ({ status: 'DOWN' as const }), critical: false },
        ],
        groups: { readiness: ['downSvc'] },
      },
    });

    expect(fastify.decorate).not.toHaveBeenCalled();

    const healthReply = createFastifyReply();
    await handlers['GET /actuator/health']!({ query: { showDetails: 'never' } }, healthReply);
    expect(healthReply.statusCode).toBe(503);
    expect(healthReply.body.status).toBe('DOWN');

    const groupReply = createFastifyReply();
    await handlers['GET /actuator/health/:name']!({ params: { name: 'readiness' } }, groupReply);
    expect(groupReply.statusCode).toBe(503);

    const componentReply = createFastifyReply();
    await handlers['GET /actuator/health/:name']!({ params: { name: 'process' } }, componentReply);
    expect(componentReply.statusCode).toBe(200);

    const missingHealthReply = createFastifyReply();
    await handlers['GET /actuator/health/:name']!({ params: { name: 'missing' } }, missingHealthReply);
    expect(missingHealthReply.statusCode).toBe(404);

    const missingEnvReply = createFastifyReply();
    const missingEnvResult = await handlers['GET /actuator/env/:name']!({ params: { name: '__NOPE__' } }, missingEnvReply);
    expect(missingEnvReply.statusCode).toBe(404);
    expect(missingEnvResult).toBe(missingEnvReply);

    process.env['__FASTIFY_TEST_VAR__'] = 'fast';
    await expect(handlers['GET /actuator/env/:name']!({ params: { name: '__FASTIFY_TEST_VAR__' } }, createFastifyReply()))
      .resolves.toEqual({ name: '__FASTIFY_TEST_VAR__', value: 'fast' });
    delete process.env['__FASTIFY_TEST_VAR__'];

    const promReply = createFastifyReply();
    await handlers['GET /actuator/prometheus']!({}, promReply);
    expect(promReply.contentType).toContain('text/plain');
    expect(typeof promReply.body).toBe('string');
  });
});

describe('actuatorPlugin custom endpoints', () => {
  function createCapturingFastify() {
    const handlers: Record<string, Function> = {};
    const fastify: any = {
      hasDecorator: jest.fn(() => false),
      decorate: jest.fn(),
      get: jest.fn((path: string, handler: Function) => {
        handlers[`GET ${path}`] = handler;
      }),
      post: jest.fn((path: string, handler: Function) => {
        handlers[`POST ${path}`] = handler;
      }),
    };
    return { fastify, handlers };
  }

  test('mounts ecosystem-registered custom endpoints as Fastify routes', async () => {
    // Simulate a downstream package (e.g. node-eventloop-watchdog) registering
    // an endpoint globally before the Fastify plugin is registered.
    registerEndpoint({
      id: 'eventloop',
      handler: () => ({ status: 'ok', avgLag: 0 }),
    });

    const { fastify, handlers } = createCapturingFastify();
    await actuatorPlugin(fastify, { prometheus: { defaultMetrics: false } });

    const handler = handlers['GET /actuator/eventloop'];
    expect(typeof handler).toBe('function');

    const reply = createFastifyReply();
    await handler!({ query: {}, raw: {} }, reply);
    expect(reply.body).toEqual({ status: 'ok', avgLag: 0 });
  });

  test('respects POST method and contentType when registering Fastify routes', async () => {
    registerEndpoint({
      id: 'custom-post',
      method: 'POST',
      handler: () => 'plain-text',
      contentType: 'text',
    });

    const { fastify, handlers } = createCapturingFastify();
    await actuatorPlugin(fastify, { prometheus: { defaultMetrics: false } });

    const handler = handlers['POST /actuator/custom-post'];
    expect(typeof handler).toBe('function');

    const reply = createFastifyReply();
    await handler!({ query: {}, raw: {} }, reply);
    expect(reply.contentType).toContain('text/plain');
    expect(reply.body).toBe('plain-text');
  });
});

describe('root endpoint registry', () => {
  test('registerEndpoint object and invokeEndpoint expose default registry', async () => {
    registerEndpoint({
      id: 'root-object',
      handler: () => ({ ok: true }),
    });

    await expect(invokeEndpoint('/root-object')).resolves.toEqual({ ok: true });
  });

  test('registerEndpoint overload accepts id and handler', async () => {
    registerEndpoint('root-string', () => 'ok', { contentType: 'text' });

    await expect(invokeEndpoint('/root-string')).resolves.toBe('ok');
  });

  test('registerEndpoint overload requires handler', () => {
    expect(() => (registerEndpoint as any)('broken')).toThrow('registerEndpoint requires a handler');
  });
});

function createFastifyReply() {
  const reply: any = {
    statusCode: 200,
    contentType: undefined,
    body: undefined,
  };
  reply.code = jest.fn((code: number) => {
    reply.statusCode = code;
    return reply;
  });
  reply.send = jest.fn((body: unknown) => {
    reply.body = body;
    return reply;
  });
  reply.type = jest.fn((contentType: string) => {
    reply.contentType = contentType;
    return reply;
  });
  return reply;
}

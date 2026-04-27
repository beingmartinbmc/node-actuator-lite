import { actuatorMiddleware, actuatorPlugin } from '../src';

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
  ])('returns 404 for disabled %s %s', async (method, url) => {
    const { res, next } = await callHandler(url, method);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ error: 'Not found' });
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
    ]));
  });
});

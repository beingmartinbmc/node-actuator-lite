import { ActuatorServer } from '../src/core/Server';

describe('ActuatorServer', () => {
  const servers: ActuatorServer[] = [];
  let server: ActuatorServer;
  let baseUrl: string;

  afterEach(async () => {
    for (const s of servers) {
      try { await s.stop(); } catch { /* ignore */ }
    }
    servers.length = 0;
  });

  function createServer(port: number, basePath: string): ActuatorServer {
    const s = new ActuatorServer(port, basePath);
    servers.push(s);
    return s;
  }

  async function startServer(basePath = '/actuator'): Promise<string> {
    server = createServer(0, basePath);
    const port = await server.start();
    return `http://localhost:${port}${basePath}`;
  }

  // ===========================================================================
  // Routing basics
  // ===========================================================================

  test('GET route returns 200 with JSON', async () => {
    baseUrl = await startServer();
    server.get('/test', (_req, res) => {
      res.json({ ok: true });
    });
    const res = await fetch(`${baseUrl}/test`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ ok: true });
  });

  test('POST route works', async () => {
    baseUrl = await startServer();
    server.post('/submit', (_req, res) => {
      res.status(201).json({ created: true });
    });
    const res = await fetch(`${baseUrl}/submit`, { method: 'POST' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ created: true });
  });

  test('text() response sets correct content-type', async () => {
    baseUrl = await startServer();
    server.get('/text', (_req, res) => {
      res.text('hello world');
    });
    const res = await fetch(`${baseUrl}/text`);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toBe('hello world');
  });

  test('status() is chainable', async () => {
    baseUrl = await startServer();
    server.get('/chain', (_req, res) => {
      res.status(202).json({ accepted: true });
    });
    const res = await fetch(`${baseUrl}/chain`);
    expect(res.status).toBe(202);
  });

  // ===========================================================================
  // Path parameters
  // ===========================================================================

  test('path params are extracted', async () => {
    baseUrl = await startServer();
    server.get('/items/:id', (req, res) => {
      res.json({ id: req.params['id'] });
    });
    const res = await fetch(`${baseUrl}/items/42`);
    expect(await res.json()).toEqual({ id: '42' });
  });

  test('multiple path params', async () => {
    baseUrl = await startServer();
    server.get('/users/:userId/posts/:postId', (req, res) => {
      res.json({ userId: req.params['userId'], postId: req.params['postId'] });
    });
    const res = await fetch(`${baseUrl}/users/abc/posts/123`);
    expect(await res.json()).toEqual({ userId: 'abc', postId: '123' });
  });

  test('encoded path params are decoded', async () => {
    baseUrl = await startServer();
    server.get('/search/:term', (req, res) => {
      res.json({ term: req.params['term'] });
    });
    const res = await fetch(`${baseUrl}/search/hello%20world`);
    expect(await res.json()).toEqual({ term: 'hello world' });
  });

  // ===========================================================================
  // Query parameters
  // ===========================================================================

  test('query params are parsed', async () => {
    baseUrl = await startServer();
    server.get('/search', (req, res) => {
      res.json({ q: req.query['q'], page: req.query['page'] });
    });
    const res = await fetch(`${baseUrl}/search?q=test&page=2`);
    expect(await res.json()).toEqual({ q: 'test', page: '2' });
  });

  // ===========================================================================
  // 404 handling
  // ===========================================================================

  test('unmatched path returns 404', async () => {
    baseUrl = await startServer();
    const res = await fetch(`${baseUrl}/nonexistent`);
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error).toBe('Not Found');
  });

  test('wrong method returns 404', async () => {
    baseUrl = await startServer();
    server.get('/only-get', (_req, res) => res.json({ ok: true }));
    const res = await fetch(`${baseUrl}/only-get`, { method: 'POST' });
    expect(res.status).toBe(404);
  });

  test('request outside basePath returns 404', async () => {
    baseUrl = await startServer('/api');
    server.get('/test', (_req, res) => res.json({ ok: true }));

    const port = server.getPort();
    const res = await fetch(`http://localhost:${port}/wrong/test`);
    expect(res.status).toBe(404);
  });

  // ===========================================================================
  // Error handling in route handlers
  // ===========================================================================

  test('throwing route handler returns 500', async () => {
    baseUrl = await startServer();
    server.get('/error', () => {
      throw new Error('boom');
    });
    const res = await fetch(`${baseUrl}/error`);
    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.error).toBe('Internal Server Error');
  });

  test('async throwing route handler returns 500', async () => {
    baseUrl = await startServer();
    server.get('/async-error', async () => {
      throw new Error('async boom');
    });
    const res = await fetch(`${baseUrl}/async-error`);
    expect(res.status).toBe(500);
  });

  // ===========================================================================
  // getPort / stop
  // ===========================================================================

  test('getPort() returns assigned port', async () => {
    server = createServer(0, '/actuator');
    const port = await server.start();
    expect(server.getPort()).toBe(port);
    expect(port).toBeGreaterThan(0);
  });

  test('getPort() returns initial port before start', () => {
    server = createServer(9999, '/actuator');
    expect(server.getPort()).toBe(9999);
  });

  test('stop() can be called multiple times without error', async () => {
    server = createServer(0, '/actuator');
    await server.start();
    await server.stop();
    await server.stop(); // should not throw
  });

  test('stop() without start resolves immediately', async () => {
    server = createServer(0, '/actuator');
    await server.stop(); // should not throw
  });

  // ===========================================================================
  // Custom basePath
  // ===========================================================================

  test('custom basePath works', async () => {
    baseUrl = await startServer('/custom');
    server.get('/hello', (_req, res) => res.json({ msg: 'hi' }));

    const res = await fetch(`http://localhost:${server.getPort()}/custom/hello`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ msg: 'hi' });
  });

  // ===========================================================================
  // basePath root route
  // ===========================================================================

  test('root route (/) under basePath works', async () => {
    baseUrl = await startServer('/api');
    server.get('/', (_req, res) => res.json({ root: true }));

    const res = await fetch(`http://localhost:${server.getPort()}/api`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ root: true });
  });
});

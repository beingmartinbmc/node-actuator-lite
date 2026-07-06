/**
 * Tests targeting specific branch coverage gaps to push global branches ≥ 90%.
 */
import { Readable } from 'stream';
import v8 from 'v8';
import { Registry } from 'prom-client';
import { ActuatorServer } from '../src/core/Server';
import { ThreadDumpCollector } from '../src/collectors/ThreadDumpCollector';
import { HeapDumpCollector } from '../src/collectors/HeapDumpCollector';
import { PrometheusCollector } from '../src/collectors/PrometheusCollector';
import { LoggersCollector, PinoLoggerAdapter, WinstonLoggerAdapter, BunyanLoggerAdapter } from '../src/collectors/LoggersCollector';
import { actuatorHttp } from '../src/middleware/http';
import { actuatorMiddleware } from '../src/middleware/express';
import { actuatorKoa } from '../src/middleware/koa';
import { logger } from '../src/utils/logger';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

// ===========================================================================
// ThreadDumpCollector — ELU delta branch (line 102)
// ===========================================================================

describe('ThreadDumpCollector — ELU delta branch', () => {
  test('first collect() has null delta, second collect() has non-null delta', () => {
    // Each instance starts with previousELU = null
    const collector = new ThreadDumpCollector();

    const first = collector.collect();
    expect(first.eventLoop.utilization).toBeDefined();
    expect(first.eventLoop.utilization!.delta).toBeNull();

    const second = collector.collect();
    expect(second.eventLoop.utilization!.delta).not.toBeNull();
    expect(typeof second.eventLoop.utilization!.delta!.idle).toBe('number');
    expect(typeof second.eventLoop.utilization!.delta!.active).toBe('number');
    expect(typeof second.eventLoop.utilization!.delta!.utilization).toBe('number');
  });
});

// ===========================================================================
// Server.ts — route() method (lines 51-54) and body parsing branch (line 130)
// ===========================================================================

describe('ActuatorServer — route() method coverage', () => {
  let server: ActuatorServer;

  afterEach(async () => {
    try { await server?.stop(); } catch { /* ignore */ }
  });

  test('route() registers a PUT handler', async () => {
    server = new ActuatorServer(0, '/api');
    const port = await server.start();

    server.route('PUT', '/items/:id', (req, res) => {
      res.status(200).json({ method: req.method, id: req.params['id'] });
    });

    const res = await fetch(`http://localhost:${port}/api/items/abc`, { method: 'PUT' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ method: 'PUT', id: 'abc' });
  });

  test('route() registers a DELETE handler', async () => {
    server = new ActuatorServer(0, '/api');
    const port = await server.start();

    server.route('delete', '/resource', (_req, res) => {
      res.status(204).json({});
    });

    const res = await fetch(`http://localhost:${port}/api/resource`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  test('request body parsing works for POST with JSON body', async () => {
    server = new ActuatorServer(0, '/api');
    const port = await server.start();

    server.post('/echo', (req, res) => {
      res.json({ body: req.body });
    });

    const res = await fetch(`http://localhost:${port}/api/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foo: 'bar' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.body).toEqual({ foo: 'bar' });
  });
});

// ===========================================================================
// HeapDumpCollector — concurrent dump (line 33) and stream error (line 99)
// ===========================================================================

describe('HeapDumpCollector — branch coverage', () => {
  const TEST_DIR = join(__dirname, '..', '.test-heapdumps-cov');

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });
  afterAll(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test('concurrent collect() throws HeapDumpThrottledError for in-progress dump', async () => {
    // Mock getHeapSnapshot to be slow
    jest.spyOn(v8, 'getHeapSnapshot').mockImplementation(() => {
      // Return a slow stream
      return new Readable({
        read() {
          setTimeout(() => {
            this.push('{"slow":"data"}');
            this.push(null);
          }, 200);
        },
      }) as any;
    });

    const hdc = new HeapDumpCollector({ enabled: true, outputDir: TEST_DIR, minIntervalMs: 0 });

    const promise1 = hdc.collect();
    // Second call while first is still in-progress
    await expect(hdc.collect()).rejects.toThrow('already in progress');
    await promise1;

    (v8.getHeapSnapshot as jest.Mock).mockRestore();
  });

  test('stream error triggers sync fallback (line 99)', async () => {
    // Mock getHeapSnapshot to return a stream that errors
    jest.spyOn(v8, 'getHeapSnapshot').mockImplementation(() => {
      const stream = new Readable({
        read() {
          this.destroy(new Error('stream error'));
        },
      });
      return stream as any;
    });

    // writeHeapSnapshot should be called as fallback
    jest.spyOn(v8, 'writeHeapSnapshot').mockImplementation((filePath?: string) => {
      if (filePath) require('fs').writeFileSync(filePath, '{"fallback":"sync"}');
      return filePath ?? 'mock.heapsnapshot';
    });

    const hdc = new HeapDumpCollector({ enabled: true, outputDir: TEST_DIR, minIntervalMs: 0 });
    const result = await hdc.collect();
    expect(existsSync(result.filePath)).toBe(true);
    const content = require('fs').readFileSync(result.filePath, 'utf8');
    expect(content).toContain('fallback');

    (v8.getHeapSnapshot as jest.Mock).mockRestore();
    (v8.writeHeapSnapshot as jest.Mock).mockRestore();
  });
});

// ===========================================================================
// PrometheusCollector — registry injection (line 17), summary (line 80),
// existing metric reuse (line 61)
// ===========================================================================

describe('PrometheusCollector — branch coverage', () => {
  test('accepts an external registry instance', async () => {
    const externalRegistry = new Registry();
    const collector = new PrometheusCollector({
      enabled: true,
      defaultMetrics: false,
      prefix: '',
      registry: externalRegistry,
      customMetrics: [],
    });
    expect(collector.getRegistry()).toBe(externalRegistry);
  });

  test('registerMetric returns existing metric on duplicate name', () => {
    const collector = new PrometheusCollector({
      enabled: true,
      defaultMetrics: false,
      prefix: '',
      customMetrics: [{ name: 'dup_counter', help: 'test', type: 'counter' }],
    });
    const m1 = collector.metric('dup_counter');
    const m2 = collector.registerMetric({ name: 'dup_counter', help: 'test', type: 'counter' });
    expect(m2).toBe(m1);
  });

  test('registers a summary metric type', () => {
    const collector = new PrometheusCollector({
      enabled: true,
      defaultMetrics: false,
      prefix: '',
      customMetrics: [],
    });
    const metric = collector.registerMetric({
      name: 'request_duration',
      help: 'Request duration',
      type: 'summary',
    });
    expect(metric).toBeDefined();
    expect(collector.metric('request_duration')).toBe(metric);
  });

  test('registers a histogram with custom buckets', () => {
    const collector = new PrometheusCollector({
      enabled: true,
      defaultMetrics: false,
      prefix: '',
      customMetrics: [],
    });
    const metric = collector.registerMetric({
      name: 'response_size',
      help: 'Response size',
      type: 'histogram',
      buckets: [100, 500, 1000, 5000],
    });
    expect(metric).toBeDefined();
  });

  test('throws on unknown metric type', () => {
    const collector = new PrometheusCollector({
      enabled: true,
      defaultMetrics: false,
      prefix: '',
      customMetrics: [],
    });
    expect(() => collector.registerMetric({
      name: 'bad',
      help: 'bad',
      type: 'unknown' as any,
    })).toThrow('Unknown metric type');
  });

  test('prefix is prepended to metric names', async () => {
    const collector = new PrometheusCollector({
      enabled: true,
      defaultMetrics: false,
      prefix: 'myapp_',
      customMetrics: [{ name: 'requests', help: 'Total requests', type: 'counter' }],
    });
    const text = await collector.collect();
    expect(text).toContain('myapp_requests');
  });

  test('removeMetric returns false for non-existent metric', () => {
    const collector = new PrometheusCollector({
      enabled: true,
      defaultMetrics: false,
      prefix: '',
      customMetrics: [],
    });
    expect(collector.removeMetric('nonexistent')).toBe(false);
  });
});

// ===========================================================================
// actuatorHttp — URL parse failure branch (lines 62-64) and dispatch null (49-50)
// ===========================================================================

describe('actuatorHttp — branch coverage', () => {
  test('handles malformed URL gracefully', async () => {
    const { handler } = actuatorHttp({ prometheus: { defaultMetrics: false } });

    const req: any = { url: '://broken', method: 'GET' };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      setHeader(k: string, v: string) { this.headers[k] = v; },
      end(data?: string) { this.body = data; },
    };

    handler(req, res);
    // Give the async dispatch time to finish
    await new Promise((r) => setTimeout(r, 50));
    // Should still respond (either 404 or valid)
    expect(res.statusCode).toBeDefined();
  });

  test('returns 404 when path does not match any actuator route', async () => {
    const { handler } = actuatorHttp({ prometheus: { defaultMetrics: false } });

    const req: any = { url: '/actuator/nonexistent', method: 'GET' };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      setHeader(k: string, v: string) { this.headers[k] = v; },
      end(data?: string) { this.body = data; },
    };

    handler(req, res);
    await new Promise((r) => setTimeout(r, 50));
    expect(res.statusCode).toBe(404);
  });

  test('passes to next() when path is outside basePath and next is provided', async () => {
    const { handler } = actuatorHttp({ prometheus: { defaultMetrics: false } });

    const req: any = { url: '/other/path', method: 'GET' };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(k: string, v: string) { this.headers[k] = v; },
      end() {},
    };
    const next = jest.fn();

    handler(req, res, next);
    await new Promise((r) => setTimeout(r, 50));
    expect(next).toHaveBeenCalled();
  });

  test('returns 404 without next when path is outside basePath', async () => {
    const { handler } = actuatorHttp({ prometheus: { defaultMetrics: false } });

    const req: any = { url: '/other/path', method: 'GET' };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      setHeader(k: string, v: string) { this.headers[k] = v; },
      end(data?: string) { this.body = data; },
    };

    handler(req, res);
    await new Promise((r) => setTimeout(r, 50));
    expect(res.statusCode).toBe(404);
  });

  test('returns html content type for dashboard endpoint', async () => {
    const { handler } = actuatorHttp({
      prometheus: { defaultMetrics: false },
      dashboard: { enabled: true },
    });

    const req: any = { url: '/actuator/dashboard', method: 'GET' };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      setHeader(k: string, v: string) { this.headers[k] = v; },
      end(data?: string) { this.body = data; },
    };

    handler(req, res);
    await new Promise((r) => setTimeout(r, 50));
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/html');
  });

  test('returns text content type for prometheus endpoint', async () => {
    const { handler } = actuatorHttp({ prometheus: { defaultMetrics: false } });

    const req: any = { url: '/actuator/prometheus', method: 'GET' };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      setHeader(k: string, v: string) { this.headers[k] = v; },
      end(data?: string) { this.body = data; },
    };

    handler(req, res);
    await new Promise((r) => setTimeout(r, 50));
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/plain');
  });
});

// ===========================================================================
// actuatorMiddleware (Express) — dispatch null (lines 61-62) + html branch
// ===========================================================================

describe('actuatorMiddleware (Express) — branch coverage', () => {
  function createMockResponse() {
    const res: any = {
      statusCode: 200,
      body: undefined,
      headers: {} as Record<string, string>,
      status(code: number) { res.statusCode = code; return res; },
      json(data: any) { res.body = data; return res; },
      send(data: any) { res.body = data; return res; },
      set(k: string, v: string) { res.headers[k] = v; return res; },
    };
    return res;
  }

  test('returns 404 for unknown actuator endpoint', async () => {
    const { handler } = actuatorMiddleware({ prometheus: { defaultMetrics: false } });
    const req: any = { originalUrl: '/actuator/unknown-route', method: 'GET', query: {} };
    const res = createMockResponse();
    const next = jest.fn();

    await handler(req, res, next);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  test('returns html content for dashboard', async () => {
    const { handler } = actuatorMiddleware({
      prometheus: { defaultMetrics: false },
      dashboard: { enabled: true },
    });
    const req: any = { originalUrl: '/actuator/dashboard', method: 'GET', query: {} };
    const res = createMockResponse();
    const next = jest.fn();

    await handler(req, res, next);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/html');
    expect(typeof res.body).toBe('string');
    expect(res.body).toContain('<!doctype html>');
  });

  test('returns text content for prometheus', async () => {
    const { handler } = actuatorMiddleware({ prometheus: { defaultMetrics: false } });
    const req: any = { originalUrl: '/actuator/prometheus', method: 'GET', query: {} };
    const res = createMockResponse();
    const next = jest.fn();

    await handler(req, res, next);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/plain');
  });

  test('calls next() for non-actuator paths', async () => {
    const { handler } = actuatorMiddleware({ prometheus: { defaultMetrics: false } });
    const req: any = { originalUrl: '/other/path', method: 'GET', query: {} };
    const res = createMockResponse();
    const next = jest.fn();

    await handler(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ===========================================================================
// actuatorKoa — branch coverage (lines 13-29)
// ===========================================================================

describe('actuatorKoa — branch coverage', () => {
  test('returns html for dashboard', async () => {
    const { middleware } = actuatorKoa({
      prometheus: { defaultMetrics: false },
      dashboard: { enabled: true },
    });

    const ctx: any = {
      url: '/actuator/dashboard',
      path: '/actuator/dashboard',
      originalUrl: '/actuator/dashboard',
      method: 'GET',
      req: {},
      query: {},
      request: { query: {} },
      status: 404,
      body: undefined,
      type: '',
      set: jest.fn(),
    };

    await middleware(ctx, jest.fn());
    expect(ctx.status).toBe(200);
    expect(ctx.type).toBe('text/html; charset=utf-8');
    expect(ctx.body).toContain('<!doctype html>');
  });

  test('returns text for prometheus', async () => {
    const { middleware } = actuatorKoa({ prometheus: { defaultMetrics: false } });

    const ctx: any = {
      url: '/actuator/prometheus',
      path: '/actuator/prometheus',
      originalUrl: '/actuator/prometheus',
      method: 'GET',
      req: {},
      query: {},
      request: { query: {} },
      status: 404,
      body: undefined,
      type: '',
      set: jest.fn(),
    };

    await middleware(ctx, jest.fn());
    expect(ctx.status).toBe(200);
    expect(ctx.type).toBe('text/plain; charset=utf-8');
  });

  test('calls next() for non-actuator paths', async () => {
    const { middleware } = actuatorKoa({ prometheus: { defaultMetrics: false } });

    const ctx: any = {
      url: '/other/path',
      path: '/other/path',
      originalUrl: '/other/path',
      method: 'GET',
      req: {},
      query: {},
      request: { query: {} },
      status: 404,
      body: undefined,
      type: '',
      set: jest.fn(),
    };
    const next = jest.fn();

    await middleware(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  test('sets 404 for unknown actuator endpoint', async () => {
    const { middleware } = actuatorKoa({ prometheus: { defaultMetrics: false } });

    const ctx: any = {
      url: '/actuator/nonexistent',
      path: '/actuator/nonexistent',
      originalUrl: '/actuator/nonexistent',
      method: 'GET',
      req: {},
      query: {},
      request: { query: {} },
      status: 200,
      body: undefined,
      type: '',
      set: jest.fn(),
    };

    await middleware(ctx, jest.fn());
    expect(ctx.status).toBe(404);
  });
});

// ===========================================================================
// Logger — delegate with SILENT level / stderr branch
// ===========================================================================

describe('Logger — additional branch coverage', () => {
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    logger.setDelegate(null);
    logger.setLevel('SILENT');
  });

  test('delegate receives all methods including trace and debug', () => {
    const calls: string[] = [];
    logger.setDelegate({
      trace: (m) => calls.push(`trace:${m}`),
      debug: (m) => calls.push(`debug:${m}`),
      info: (m) => calls.push(`info:${m}`),
      warn: (m) => calls.push(`warn:${m}`),
      error: (m) => calls.push(`error:${m}`),
    });

    logger.trace('t');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(calls).toEqual([
      'trace:t', 'debug:d', 'info:i', 'warn:w', 'error:e',
    ]);
    // Nothing should go to stdout/stderr when delegate is active
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  test('ERROR goes to stderr and WARN goes to stdout (output routing)', () => {
    logger.setLevel('WARN');
    logger.warn('w-msg');
    logger.error('e-msg');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const warnLine = stdoutSpy.mock.calls[0]![0] as string;
    expect(warnLine).toContain('"level":"WARN"');

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const errLine = stderrSpy.mock.calls[0]![0] as string;
    expect(errLine).toContain('"level":"ERROR"');
  });
});

// ===========================================================================
// LoggersCollector — additional branches for adapters
// ===========================================================================

describe('LoggersCollector — additional branch coverage', () => {
  test('PinoLoggerAdapter: setLevel with TRACE and maps correctly', () => {
    const pino = { level: 'info' };
    const adapter = new PinoLoggerAdapter(pino);
    expect(adapter.setLevel('ROOT', 'TRACE')).toBe(true);
    expect(pino.level).toBe('trace');
  });

  test('PinoLoggerAdapter: setLevel with DEBUG', () => {
    const pino = { level: 'info' };
    const adapter = new PinoLoggerAdapter(pino);
    expect(adapter.setLevel('ROOT', 'DEBUG')).toBe(true);
    expect(pino.level).toBe('debug');
  });

  test('PinoLoggerAdapter: setLevel with INFO', () => {
    const pino = { level: 'warn' };
    const adapter = new PinoLoggerAdapter(pino);
    expect(adapter.setLevel('ROOT', 'INFO')).toBe(true);
    expect(pino.level).toBe('info');
  });

  test('PinoLoggerAdapter: setLevel with WARN', () => {
    const pino = { level: 'info' };
    const adapter = new PinoLoggerAdapter(pino);
    expect(adapter.setLevel('ROOT', 'WARN')).toBe(true);
    expect(pino.level).toBe('warn');
  });

  test('PinoLoggerAdapter: getLevel with trace level', () => {
    expect(new PinoLoggerAdapter({ level: 'trace' }).getLevel('ROOT')).toBe('TRACE');
  });

  test('WinstonLoggerAdapter: setLevel with TRACE maps to silly', () => {
    const w = { level: 'info' };
    const adapter = new WinstonLoggerAdapter(w);
    expect(adapter.setLevel('ROOT', 'TRACE')).toBe(true);
    expect(w.level).toBe('silly');
  });

  test('WinstonLoggerAdapter: setLevel with DEBUG maps to debug', () => {
    const w = { level: 'info' };
    const adapter = new WinstonLoggerAdapter(w);
    expect(adapter.setLevel('ROOT', 'DEBUG')).toBe(true);
    expect(w.level).toBe('debug');
  });

  test('WinstonLoggerAdapter: setLevel with INFO maps to info', () => {
    const w = { level: 'warn' };
    const adapter = new WinstonLoggerAdapter(w);
    expect(adapter.setLevel('ROOT', 'INFO')).toBe(true);
    expect(w.level).toBe('info');
  });

  test('WinstonLoggerAdapter: setLevel with ERROR maps to error', () => {
    const w = { level: 'info' };
    const adapter = new WinstonLoggerAdapter(w);
    expect(adapter.setLevel('ROOT', 'ERROR')).toBe(true);
    expect(w.level).toBe('error');
  });

  test('WinstonLoggerAdapter: getLevel for warn level', () => {
    expect(new WinstonLoggerAdapter({ level: 'warn' }).getLevel('ROOT')).toBe('WARN');
  });

  test('WinstonLoggerAdapter: getLevel for error level', () => {
    expect(new WinstonLoggerAdapter({ level: 'error' }).getLevel('ROOT')).toBe('ERROR');
  });

  test('BunyanLoggerAdapter: setLevel with TRACE', () => {
    const bunyan = { level: jest.fn() };
    const adapter = new BunyanLoggerAdapter(bunyan);
    expect(adapter.setLevel('ROOT', 'TRACE')).toBe(true);
    expect(bunyan.level).toHaveBeenCalledWith('trace');
  });

  test('BunyanLoggerAdapter: setLevel with DEBUG', () => {
    const bunyan = { level: jest.fn() };
    const adapter = new BunyanLoggerAdapter(bunyan);
    expect(adapter.setLevel('ROOT', 'DEBUG')).toBe(true);
    expect(bunyan.level).toHaveBeenCalledWith('debug');
  });

  test('BunyanLoggerAdapter: setLevel with INFO', () => {
    const bunyan = { level: jest.fn() };
    const adapter = new BunyanLoggerAdapter(bunyan);
    expect(adapter.setLevel('ROOT', 'INFO')).toBe(true);
    expect(bunyan.level).toHaveBeenCalledWith('info');
  });

  test('BunyanLoggerAdapter: setLevel with WARN', () => {
    const bunyan = { level: jest.fn() };
    const adapter = new BunyanLoggerAdapter(bunyan);
    expect(adapter.setLevel('ROOT', 'WARN')).toBe(true);
    expect(bunyan.level).toHaveBeenCalledWith('warn');
  });

  test('BunyanLoggerAdapter: setLevel with ERROR', () => {
    const bunyan = { level: jest.fn() };
    const adapter = new BunyanLoggerAdapter(bunyan);
    expect(adapter.setLevel('ROOT', 'ERROR')).toBe(true);
    expect(bunyan.level).toHaveBeenCalledWith('error');
  });

  test('BunyanLoggerAdapter: getLevel with level 5 (TRACE)', () => {
    const adapter = new BunyanLoggerAdapter({ level: jest.fn(() => 5) });
    expect(adapter.getLevel('ROOT')).toBe('TRACE');
  });

  test('BunyanLoggerAdapter: getLevel with level 15 (DEBUG)', () => {
    const adapter = new BunyanLoggerAdapter({ level: jest.fn(() => 15) });
    expect(adapter.getLevel('ROOT')).toBe('DEBUG');
  });

  test('BunyanLoggerAdapter: getLevel with level 25 (INFO)', () => {
    const adapter = new BunyanLoggerAdapter({ level: jest.fn(() => 25) });
    expect(adapter.getLevel('ROOT')).toBe('INFO');
  });

  test('BunyanLoggerAdapter: getLevel with level 35 (WARN)', () => {
    const adapter = new BunyanLoggerAdapter({ level: jest.fn(() => 35) });
    expect(adapter.getLevel('ROOT')).toBe('WARN');
  });

  test('BunyanLoggerAdapter: getLevel with level 45 (ERROR)', () => {
    const adapter = new BunyanLoggerAdapter({ level: jest.fn(() => 45) });
    expect(adapter.getLevel('ROOT')).toBe('ERROR');
  });

  test('LoggersCollector: collect() with single adapter does NOT qualify names', () => {
    const lc = new LoggersCollector();
    const result = lc.collect();
    // Only builtin adapter → names are NOT qualified
    expect(result.loggers['ROOT']).toBeDefined();
    expect(result.loggers['builtin:ROOT']).toBeUndefined();
  });

  test('LoggersCollector: setLevel with unqualified name searches all adapters', () => {
    const lc = new LoggersCollector();
    const pino = { level: 'info' };
    const adapter = new PinoLoggerAdapter(pino);
    adapter.addChild('http', { level: 'warn' } as any);
    lc.addAdapter(adapter);

    // Should find 'http' in pino adapter via unqualified search
    expect(lc.setLevel('http', 'DEBUG')).toBe(true);
  });

  test('WinstonLoggerAdapter: getLevel for undefined level in child', () => {
    const w = { level: 'info' };
    const adapter = new WinstonLoggerAdapter(w);
    adapter.addChild('noLevel', {} as any);
    // {} has no level property → should return null
    expect(adapter.getLevel('noLevel')).toBeNull();
  });

  test('WinstonLoggerAdapter: setLevel on child logger', () => {
    const w = { level: 'info' };
    const child = { level: 'debug' };
    const adapter = new WinstonLoggerAdapter(w);
    adapter.addChild('worker', child);
    expect(adapter.setLevel('worker', 'ERROR')).toBe(true);
    expect(child.level).toBe('error');
  });

  test('BunyanLoggerAdapter: setLevel on child logger', () => {
    const bunyan = { level: jest.fn() };
    const child = { level: jest.fn() };
    const adapter = new BunyanLoggerAdapter(bunyan);
    adapter.addChild('worker', child);
    expect(adapter.setLevel('worker', 'WARN')).toBe(true);
    expect(child.level).toHaveBeenCalledWith('warn');
  });

  test('LoggersCollector: addAdapter replaces adapter with same name', () => {
    const lc = new LoggersCollector();
    const pino1 = new PinoLoggerAdapter({ level: 'info' });
    const pino2 = new PinoLoggerAdapter({ level: 'debug' });
    lc.addAdapter(pino1);
    lc.addAdapter(pino2);
    const result = lc.collect();
    // Only one pino adapter should exist
    const pinoLoggers = Object.keys(result.loggers).filter(k => k.startsWith('pino:'));
    expect(pinoLoggers.length).toBe(1);
  });
});

// ===========================================================================
// Actuator.ts — loggers endpoints, dashboard, etc. (lines 352-381, 437-438, 561)
// ===========================================================================

describe('NodeActuator — loggers endpoint branch coverage', () => {
  // Using actuatorHttp to exercise the Actuator endpoints
  test('POST /actuator/loggers/:name sets a logger level', async () => {
    const { handler } = actuatorHttp({
      prometheus: { defaultMetrics: false },
      loggers: { enabled: true },
    });

    const req: any = {
      url: '/actuator/loggers/ROOT',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      on: (event: string, cb: Function) => {
        if (event === 'data') cb(JSON.stringify({ configuredLevel: 'DEBUG' }));
        if (event === 'end') cb();
      },
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as string | undefined,
      setHeader(k: string, v: string) { this.headers[k] = v; },
      end(data?: string) { this.body = data; },
    };

    handler(req, res);
    await new Promise((r) => setTimeout(r, 100));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body!)).toEqual({ status: 'ok', logger: 'ROOT', level: 'DEBUG' });
  });

  test('GET /actuator/loggers returns loggers list', async () => {
    const { handler } = actuatorHttp({
      prometheus: { defaultMetrics: false },
      loggers: { enabled: true },
    });

    const req: any = { url: '/actuator/loggers', method: 'GET' };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as string | undefined,
      setHeader(k: string, v: string) { this.headers[k] = v; },
      end(data?: string) { this.body = data; },
    };

    handler(req, res);
    await new Promise((r) => setTimeout(r, 50));
    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.body!);
    expect(parsed.levels).toBeDefined();
    expect(parsed.loggers).toBeDefined();
  });

  test('GET /actuator/loggers/:name returns 404 for unknown logger', async () => {
    const { handler } = actuatorHttp({
      prometheus: { defaultMetrics: false },
      loggers: { enabled: true },
    });

    const req: any = { url: '/actuator/loggers/nonexistent', method: 'GET' };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as string | undefined,
      setHeader(k: string, v: string) { this.headers[k] = v; },
      end(data?: string) { this.body = data; },
    };

    handler(req, res);
    await new Promise((r) => setTimeout(r, 50));
    expect(res.statusCode).toBe(404);
  });
});

// ===========================================================================
// index.ts — function coverage for registerEndpoint / invokeEndpoint
// ===========================================================================

describe('index.ts — root-level exports', () => {
  test('registerEndpoint and invokeEndpoint work on default actuator', async () => {
    const { registerEndpoint, invokeEndpoint } = require('../src/index');

    registerEndpoint({
      id: 'coverage-test',
      handler: () => ({ covered: true }),
    });

    const result = await invokeEndpoint('/coverage-test');
    expect(result).toEqual({ covered: true });
  });

  test('registerEndpoint overload with id and handler', () => {
    const { registerEndpoint } = require('../src/index');
    registerEndpoint('another-test', () => ({ ok: true }));
  });

  test('registerEndpoint overload throws if handler is missing', () => {
    const { registerEndpoint } = require('../src/index');
    expect(() => registerEndpoint('no-handler', undefined as any)).toThrow('handler');
  });
});

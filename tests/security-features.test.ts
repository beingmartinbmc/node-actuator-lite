import { NodeActuator } from '../src/core/Actuator';
import { HeapDumpCollector, HeapDumpThrottledError } from '../src/collectors/HeapDumpCollector';
import { EnvironmentCollector } from '../src/collectors/EnvironmentCollector';
import { logger } from '../src/utils/logger';
import type { ResolvedActuatorOptions } from '../src/core/types';
import { Readable } from 'stream';
import v8 from 'v8';

// Both snapshot APIs must be mocked. A real v8.getHeapSnapshot() stream can
// stall indefinitely inside a jest worker (reproducible on Node 20), and since
// it never errors the sync fallback below is never reached.
jest.spyOn(v8, 'getHeapSnapshot').mockImplementation(() => {
  const stream = new Readable({
    read() {
      this.push('{"mock":"heapdump-stream"}');
      this.push(null);
    },
  });
  return stream as any;
});

jest.spyOn(v8, 'writeHeapSnapshot').mockImplementation((filePath?: string) => {
  if (filePath) require('fs').writeFileSync(filePath, '{"mock":"heapdump"}');
  return filePath ?? 'mock.heapsnapshot';
});

afterEach(() => logger.setDelegate(null));

describe('auth callback', () => {
  test('dispatch rejects unauthorized requests with 401', async () => {
    const actuator = new NodeActuator({
      serverless: true,
      auth: (ctx) => ctx.query['token'] === 'secret',
    });

    const denied = await actuator.dispatch({ method: 'GET', subPath: '/health', query: {}, params: {} });
    expect(denied?.status).toBe(401);
    expect(denied?.body).toEqual({ error: 'Unauthorized' });

    const allowed = await actuator.dispatch({ method: 'GET', subPath: '/health', query: { token: 'secret' }, params: {} });
    expect(allowed?.status).toBe(200);
  });

  test('a throwing auth callback is treated as rejection', async () => {
    const actuator = new NodeActuator({
      serverless: true,
      auth: () => { throw new Error('boom'); },
    });
    const res = await actuator.dispatch({ method: 'GET', subPath: '/info', query: {}, params: {} });
    expect(res?.status).toBe(401);
  });

  test('dispatch returns null for unknown paths', async () => {
    const actuator = new NodeActuator({ serverless: true });
    const res = await actuator.dispatch({ method: 'GET', subPath: '/nope', query: {}, params: {} });
    expect(res).toBeNull();
  });

  test('dispatch resolves path params and normalises empty subPath to root', async () => {
    process.env['__AUTH_PLAIN_NAME__'] = 'v';
    const actuator = new NodeActuator({ serverless: true });

    const root = await actuator.dispatch({ method: 'GET', subPath: '', query: {}, params: {} });
    expect(root?.body).toHaveProperty('_links');

    const envVar = await actuator.dispatch({ method: 'GET', subPath: '/env/__AUTH_PLAIN_NAME__', query: {}, params: {} });
    expect(envVar?.body).toHaveProperty('name', '__AUTH_PLAIN_NAME__');
    delete process.env['__AUTH_PLAIN_NAME__'];
  });
});

describe('heap dump throttling', () => {
  function makeConfig(overrides: Partial<ResolvedActuatorOptions['heapDump']> = {}) {
    return { enabled: true, outputDir: './.test-throttle', minIntervalMs: 0, ...overrides };
  }

  test('rejects a second dump within the min interval', async () => {
    const collector = new HeapDumpCollector(makeConfig({ minIntervalMs: 60000 }));
    await collector.collect();
    await expect(collector.collect()).rejects.toBeInstanceOf(HeapDumpThrottledError);
    try {
      await collector.collect();
    } catch (err) {
      expect((err as HeapDumpThrottledError).retryAfterMs).toBeGreaterThan(0);
    }
  });

  test('heapdump endpoint maps throttling to HTTP 429', async () => {
    const actuator = new NodeActuator({
      serverless: true,
      heapDump: { enabled: true, outputDir: './.test-throttle', minIntervalMs: 60000 },
    });
    const first = await actuator.dispatch({ method: 'POST', subPath: '/heapdump', query: {}, params: {} });
    expect(first?.status).toBe(200);
    const second = await actuator.dispatch({ method: 'POST', subPath: '/heapdump', query: {}, params: {} });
    expect(second?.status).toBe(429);
  });

  afterAll(() => {
    require('fs').rmSync('./.test-throttle', { recursive: true, force: true });
  });
});

describe('environment allowlist', () => {
  function makeConfig(allowlist?: string[]): ResolvedActuatorOptions['env'] {
    return {
      enabled: true,
      mask: { patterns: [], additional: [], replacement: '***', allowlist },
    };
  }

  test('omits variables not on the allowlist entirely', () => {
    process.env['__ALLOWED__'] = 'yes';
    process.env['__SECRET_HIDDEN__'] = 'no';
    const collector = new EnvironmentCollector(makeConfig(['__ALLOWED__']));

    const result = collector.collect();
    const props = result.propertySources[0]!.properties;
    expect(props).toHaveProperty('__ALLOWED__');
    expect(props).not.toHaveProperty('__SECRET_HIDDEN__');

    expect(collector.variable('__SECRET_HIDDEN__')).toBeNull();
    expect(collector.variable('__ALLOWED__')).toEqual({ name: '__ALLOWED__', value: 'yes' });

    delete process.env['__ALLOWED__'];
    delete process.env['__SECRET_HIDDEN__'];
  });
});

describe('safety preset', () => {
  const originalNodeEnv = process.env['NODE_ENV'];

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = originalNodeEnv;
  });

  test('preset: "production" disables sensitive endpoints and hides health details', () => {
    const actuator = new NodeActuator({ serverless: true, preset: 'production' });
    const opts = (actuator as any).opts as ResolvedActuatorOptions;

    expect(opts.env.enabled).toBe(false);
    expect(opts.threadDump.enabled).toBe(false);
    expect(opts.heapDump.enabled).toBe(false);
    expect(opts.loggers.enabled).toBe(false);
    expect(opts.dashboard.enabled).toBe(false);
    expect(opts.health.showDetails).toBe('never');
  });

  test('preset: "production" keeps health/info/metrics/prometheus enabled by default', () => {
    const actuator = new NodeActuator({ serverless: true, preset: 'production' });
    const opts = (actuator as any).opts as ResolvedActuatorOptions;

    expect(opts.health.enabled).toBe(true);
    expect(opts.info.enabled).toBe(true);
    expect(opts.metrics.enabled).toBe(true);
    expect(opts.prometheus.enabled).toBe(true);
  });

  test('explicit per-endpoint settings override the production preset', () => {
    const actuator = new NodeActuator({
      serverless: true,
      preset: 'production',
      env: { enabled: true },
    });
    const opts = (actuator as any).opts as ResolvedActuatorOptions;
    expect(opts.env.enabled).toBe(true);
  });

  test('preset: "development" (explicit) enables everything regardless of NODE_ENV', () => {
    process.env['NODE_ENV'] = 'production';
    const actuator = new NodeActuator({ serverless: true, preset: 'development' });
    const opts = (actuator as any).opts as ResolvedActuatorOptions;

    expect(opts.env.enabled).toBe(true);
    expect(opts.threadDump.enabled).toBe(true);
    expect(opts.heapDump.enabled).toBe(true);
    expect(opts.loggers.enabled).toBe(true);
    expect(opts.dashboard.enabled).toBe(true);
    expect(opts.health.showDetails).toBe('always');
  });

  test('NODE_ENV=production alone does NOT auto-disable endpoints (opt-in required)', () => {
    // Auto-flipping defaults from NODE_ENV would silently disable endpoints
    // for existing deployments on upgrade — preset must be explicit.
    process.env['NODE_ENV'] = 'production';
    const actuator = new NodeActuator({ serverless: true });
    const opts = (actuator as any).opts as ResolvedActuatorOptions;

    expect(opts.env.enabled).toBe(true);
    expect(opts.dashboard.enabled).toBe(true);
    expect(opts.health.showDetails).toBe('always');
  });

  test('defaults to development behaviour when NODE_ENV is not production', () => {
    process.env['NODE_ENV'] = 'test';
    const actuator = new NodeActuator({ serverless: true });
    const opts = (actuator as any).opts as ResolvedActuatorOptions;

    expect(opts.env.enabled).toBe(true);
    expect(opts.dashboard.enabled).toBe(true);
  });

  test('warns (but does not change defaults) when NODE_ENV=production has no explicit preset', () => {
    process.env['NODE_ENV'] = 'production';
    const warnings: string[] = [];
    logger.setDelegate({
      trace: () => {}, debug: () => {}, info: () => {}, error: () => {},
      warn: (m: string) => warnings.push(m),
    });

    new NodeActuator({ serverless: true });

    expect(warnings.some((m) => m.includes("NODE_ENV=production detected but no 'preset' was set"))).toBe(true);
  });

  test('does not emit the NODE_ENV nudge warning once preset is explicit', () => {
    process.env['NODE_ENV'] = 'production';
    const warnings: string[] = [];
    logger.setDelegate({
      trace: () => {}, debug: () => {}, info: () => {}, error: () => {},
      warn: (m: string) => warnings.push(m),
    });

    new NodeActuator({ serverless: true, preset: 'production' });

    expect(warnings.some((m) => m.includes('NODE_ENV=production detected'))).toBe(false);
  });

  test('warns when sensitive endpoints are enabled without an auth callback', () => {
    const warnings: string[] = [];
    logger.setDelegate({
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: (m: string) => warnings.push(m),
      error: () => {},
    });

    new NodeActuator({ serverless: true });

    expect(warnings.some((m) => m.includes('Sensitive endpoints enabled without auth'))).toBe(true);
  });

  test('does not warn when an auth callback is configured', () => {
    const warnings: string[] = [];
    logger.setDelegate({
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: (m: string) => warnings.push(m),
      error: () => {},
    });

    new NodeActuator({ serverless: true, auth: () => true });

    expect(warnings.some((m) => m.includes('Sensitive endpoints enabled without auth'))).toBe(false);
  });

  test('does not warn when preset: "production" disables all sensitive endpoints', () => {
    const warnings: string[] = [];
    logger.setDelegate({
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: (m: string) => warnings.push(m),
      error: () => {},
    });

    new NodeActuator({ serverless: true, preset: 'production' });

    expect(warnings.some((m) => m.includes('Sensitive endpoints enabled without auth'))).toBe(false);
  });
});

describe('pluggable logger', () => {
  test('setDelegate routes actuator log output to a custom logger', () => {
    const calls: Array<[string, string]> = [];
    const delegate = {
      trace: (m: string) => calls.push(['trace', m]),
      debug: (m: string) => calls.push(['debug', m]),
      info: (m: string) => calls.push(['info', m]),
      warn: (m: string) => calls.push(['warn', m]),
      error: (m: string) => calls.push(['error', m]),
    };
    logger.setDelegate(delegate);
    logger.warn('hello');
    logger.error('bad');
    expect(calls).toEqual([['warn', 'hello'], ['error', 'bad']]);
  });
});

import { NodeActuator } from '../src';

let actuator: NodeActuator;

afterEach(async () => {
  if (actuator) await actuator.stop();
});

// =============================================================================
// Default Config Resolution
// =============================================================================

describe('NodeActuator — config defaults', () => {
  test('constructor with no options uses all defaults', () => {
    actuator = new NodeActuator({ serverless: true });
    // Should not throw, all defaults applied
    expect(actuator.health).toBeDefined();
    expect(actuator.env).toBeDefined();
    expect(actuator.prometheus).toBeDefined();
    expect(actuator.threadDump).toBeDefined();
    expect(actuator.heapDump).toBeDefined();
  });

  test('getPort() returns 0 in serverless mode', async () => {
    actuator = new NodeActuator({ serverless: true });
    await actuator.start();
    expect(actuator.getPort()).toBe(0);
  });

  test('start() returns 0 in serverless mode', async () => {
    actuator = new NodeActuator({ serverless: true });
    const port = await actuator.start();
    expect(port).toBe(0);
  });

  test('stop() is safe in serverless mode', async () => {
    actuator = new NodeActuator({ serverless: true });
    await actuator.start();
    await actuator.stop(); // should not throw
  });
});

// =============================================================================
// Serverless Detection Warning
// =============================================================================

describe('NodeActuator — serverless env detection', () => {
  afterEach(() => {
    delete process.env['VERCEL_ENV'];
    delete process.env['NETLIFY'];
    delete process.env['AWS_LAMBDA_FUNCTION_NAME'];
  });

  test('warns when VERCEL_ENV is set without serverless flag', () => {
    process.env['VERCEL_ENV'] = 'production';
    // Should not throw, just warn
    actuator = new NodeActuator();
    expect(actuator).toBeDefined();
  });

  test('warns when NETLIFY is set without serverless flag', () => {
    process.env['NETLIFY'] = 'true';
    actuator = new NodeActuator();
    expect(actuator).toBeDefined();
  });

  test('warns when AWS_LAMBDA_FUNCTION_NAME is set without serverless flag', () => {
    process.env['AWS_LAMBDA_FUNCTION_NAME'] = 'myFunc';
    actuator = new NodeActuator();
    expect(actuator).toBeDefined();
  });

  test('no warning when serverless: true is set', () => {
    process.env['VERCEL_ENV'] = 'production';
    actuator = new NodeActuator({ serverless: true });
    expect(actuator).toBeDefined();
  });
});

// =============================================================================
// Discovery
// =============================================================================

describe('NodeActuator — discovery', () => {
  test('serverless discovery uses basePath as base', async () => {
    actuator = new NodeActuator({ serverless: true, basePath: '/custom' });
    await actuator.start();
    const d = actuator.discovery();
    expect(d._links['self']!.href).toBe('/custom');
    expect(d._links['health']!.href).toBe('/custom/health');
  });

  test('standalone discovery uses http://localhost:PORT', async () => {
    actuator = new NodeActuator({ port: 0, basePath: '/actuator' });
    const port = await actuator.start();
    const d = actuator.discovery();
    expect(d._links['self']!.href).toBe(`http://localhost:${port}/actuator`);
  });

  test('discovery includes templated links', async () => {
    actuator = new NodeActuator({ serverless: true });
    await actuator.start();
    const d = actuator.discovery();
    expect(d._links['health-component']!.templated).toBe(true);
    expect(d._links['env-variable']!.templated).toBe(true);
  });

  test('discovery omits disabled features', async () => {
    actuator = new NodeActuator({
      serverless: true,
      health: { enabled: false },
      env: { enabled: false },
      threadDump: { enabled: false },
      heapDump: { enabled: false },
      prometheus: { enabled: false },
    });
    await actuator.start();
    const d = actuator.discovery();
    expect(d._links['self']).toBeDefined();
    expect(d._links['health']).toBeUndefined();
    expect(d._links['env']).toBeUndefined();
    expect(d._links['threaddump']).toBeUndefined();
    expect(d._links['heapdump']).toBeUndefined();
    expect(d._links['prometheus']).toBeUndefined();
  });

  test('discovery includes health group links', async () => {
    actuator = new NodeActuator({
      serverless: true,
      health: { groups: { liveness: ['process'], readiness: ['diskSpace'] } },
    });
    await actuator.start();
    const d = actuator.discovery();
    expect(d._links['health-liveness']).toBeDefined();
    expect(d._links['health-readiness']).toBeDefined();
  });
});

// =============================================================================
// Programmatic API (serverless)
// =============================================================================

describe('NodeActuator — programmatic API', () => {
  beforeEach(async () => {
    actuator = new NodeActuator({
      serverless: true,
      health: {
        showDetails: 'always',
        custom: [
          { name: 'testSvc', check: async () => ({ status: 'UP', details: { ok: true } }), critical: false },
        ],
        groups: {
          liveness: ['process'],
          readiness: ['diskSpace', 'testSvc'],
        },
      },
      env: { mask: { patterns: ['PASSWORD', 'SECRET'], additional: ['MASKED_VAR'], replacement: '***' } },
      prometheus: {
        defaultMetrics: false,
        customMetrics: [
          { name: 'api_counter', help: 'API counter', type: 'counter' },
        ],
      },
    });
    await actuator.start();
  });

  // -- Health --

  test('getHealth() returns valid status', async () => {
    const h = await actuator.getHealth();
    expect(['UP', 'DOWN', 'UNKNOWN', 'OUT_OF_SERVICE']).toContain(h.status);
  });

  test('getHealth("always") includes components', async () => {
    const h = await actuator.getHealth('always');
    expect(h.components).toBeDefined();
    expect(h.components!['diskSpace']).toBeDefined();
    expect(h.components!['process']).toBeDefined();
    expect(h.components!['testSvc']).toBeDefined();
  });

  test('getHealth("never") omits components', async () => {
    const h = await actuator.getHealth('never');
    expect(h.components).toBeUndefined();
  });

  test('getHealthComponent() returns single component', async () => {
    const c = await actuator.getHealthComponent('process');
    expect(c).not.toBeNull();
    expect(c!.status).toBe('UP');
  });

  test('getHealthComponent() returns null for unknown', async () => {
    expect(await actuator.getHealthComponent('nope')).toBeNull();
  });

  test('getHealthGroup() returns group', async () => {
    const g = await actuator.getHealthGroup('liveness');
    expect(g).not.toBeNull();
    expect(g!.components!['process']).toBeDefined();
  });

  test('getHealthGroup() returns null for unknown', async () => {
    expect(await actuator.getHealthGroup('nope')).toBeNull();
  });

  // -- Health runtime management --

  test('health.addIndicator / removeIndicator at runtime', async () => {
    actuator.health.addIndicator({
      name: 'dynamic',
      check: async () => ({ status: 'UP', details: { added: true } }),
    });
    const c = await actuator.getHealthComponent('dynamic');
    expect(c!.status).toBe('UP');

    expect(actuator.health.removeIndicator('dynamic')).toBe(true);
    expect(await actuator.getHealthComponent('dynamic')).toBeNull();
  });

  // -- Env --

  test('getEnv() has correct structure', () => {
    const e = actuator.getEnv();
    expect(e.activeProfiles).toBeDefined();
    expect(e.propertySources.map((s) => s.name)).toContain('systemEnvironment');
    expect(e.propertySources.map((s) => s.name)).toContain('systemProperties');
  });

  test('getEnv() masks sensitive vars', () => {
    process.env['DB_PASSWORD'] = 'secret';
    process.env['MASKED_VAR'] = 'hidden';
    const e = actuator.getEnv();
    const sysEnv = e.propertySources.find((s) => s.name === 'systemEnvironment')!;
    expect(sysEnv.properties['DB_PASSWORD']!.value).toBe('***');
    expect(sysEnv.properties['MASKED_VAR']!.value).toBe('***');
    delete process.env['DB_PASSWORD'];
    delete process.env['MASKED_VAR'];
  });

  test('getEnvVariable() returns value', () => {
    process.env['__TEST_VAR__'] = 'val';
    expect(actuator.getEnvVariable('__TEST_VAR__')!.value).toBe('val');
    delete process.env['__TEST_VAR__'];
  });

  test('getEnvVariable() returns null for missing', () => {
    expect(actuator.getEnvVariable('__MISSING_VAR_XYZ__')).toBeNull();
  });

  // -- Thread dump --

  test('getThreadDump() returns expected shape', () => {
    const td = actuator.getThreadDump();
    expect(td.pid).toBe(process.pid);
    expect(td.nodeVersion).toBe(process.version);
    expect(td.mainThread.name).toBe('main');
    expect(td.eventLoop).toBeDefined();
    expect(td.memory).toBeDefined();
    expect(td.v8HeapStats).toBeDefined();
    expect(td.v8HeapSpaces).toBeDefined();
  });

  // -- Prometheus --

  test('getPrometheus() returns string', async () => {
    const text = await actuator.getPrometheus();
    expect(typeof text).toBe('string');
  });

  test('custom metric accessible and functional', async () => {
    const c = actuator.prometheus.metric('api_counter')!;
    (c as any).inc();
    const text = await actuator.getPrometheus();
    expect(text).toContain('api_counter');
  });
});

// =============================================================================
// Standalone HTTP Server — Full Endpoint Tests
// =============================================================================

describe('NodeActuator — standalone HTTP', () => {
  let baseUrl: string;

  beforeEach(async () => {
    actuator = new NodeActuator({
      port: 0,
      health: {
        showDetails: 'always',
        custom: [
          { name: 'downSvc', check: async () => ({ status: 'DOWN', details: { err: 'offline' } }), critical: false },
        ],
        groups: { liveness: ['process'], readiness: ['diskSpace', 'downSvc'] },
      },
      prometheus: { defaultMetrics: false },
    });
    const port = await actuator.start();
    baseUrl = `http://localhost:${port}/actuator`;
  });

  // -- Discovery --

  test('GET / returns discovery with all links', async () => {
    const res = await fetch(baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body._links.self).toBeDefined();
    expect(body._links.health).toBeDefined();
    expect(body._links.env).toBeDefined();
    expect(body._links.threaddump).toBeDefined();
    expect(body._links.heapdump).toBeDefined();
    expect(body._links.prometheus).toBeDefined();
  });

  // -- Health endpoints --

  test('GET /health returns deep health with components', async () => {
    const res = await fetch(`${baseUrl}/health`);
    const body = await res.json() as any;
    expect(body.status).toBeDefined();
    expect(body.components).toBeDefined();
    expect(body.components.process).toBeDefined();
  });

  test('GET /health returns 503 when any component is DOWN', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.status).toBe('DOWN');
  });

  test('GET /health?showDetails=never returns shallow', async () => {
    const res = await fetch(`${baseUrl}/health?showDetails=never`);
    const body = await res.json() as any;
    expect(body.status).toBeDefined();
    expect(body.components).toBeUndefined();
  });

  test('GET /health/:component returns individual component', async () => {
    const res = await fetch(`${baseUrl}/health/process`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('UP');
    expect(body.details).toBeDefined();
  });

  test('GET /health/:component returns 503 for DOWN component', async () => {
    const res = await fetch(`${baseUrl}/health/downSvc`);
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.status).toBe('DOWN');
  });

  test('GET /health/:component returns 404 for unknown', async () => {
    const res = await fetch(`${baseUrl}/health/unknown`);
    expect(res.status).toBe(404);
  });

  test('GET /health/:group returns group aggregation', async () => {
    const res = await fetch(`${baseUrl}/health/liveness`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.components.process).toBeDefined();
  });

  test('GET /health/:group returns 503 when group has DOWN member', async () => {
    const res = await fetch(`${baseUrl}/health/readiness`);
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.status).toBe('DOWN');
    expect(body.components.downSvc).toBeDefined();
  });

  // -- Env endpoints --

  test('GET /env returns env data', async () => {
    const res = await fetch(`${baseUrl}/env`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.activeProfiles).toBeDefined();
    expect(body.propertySources).toBeDefined();
  });

  test('GET /env/:name returns single var', async () => {
    process.env['__HTTP_TEST_VAR__'] = 'httpval';
    const res = await fetch(`${baseUrl}/env/__HTTP_TEST_VAR__`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.name).toBe('__HTTP_TEST_VAR__');
    expect(body.value).toBe('httpval');
    delete process.env['__HTTP_TEST_VAR__'];
  });

  test('GET /env/:name returns 404 for missing var', async () => {
    const res = await fetch(`${baseUrl}/env/__TOTALLY_MISSING_XYZ__`);
    expect(res.status).toBe(404);
  });

  // -- Thread dump --

  test('GET /threaddump returns thread dump', async () => {
    const res = await fetch(`${baseUrl}/threaddump`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.pid).toBe(process.pid);
    expect(body.mainThread).toBeDefined();
    expect(body.eventLoop).toBeDefined();
    expect(body.v8HeapStats).toBeDefined();
  });

  // -- Prometheus --

  test('GET /prometheus returns text/plain', async () => {
    const res = await fetch(`${baseUrl}/prometheus`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
  });

  // -- 404 for unknown paths --

  test('GET unknown path returns 404', async () => {
    const res = await fetch(`${baseUrl}/nonexistent`);
    expect(res.status).toBe(404);
  });

  test('request outside basePath returns 404', async () => {
    const port = actuator.getPort();
    const res = await fetch(`http://localhost:${port}/wrong/path`);
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// Standalone with disabled features
// =============================================================================

describe('NodeActuator — disabled features', () => {
  test('disabled health does not register /health routes', async () => {
    actuator = new NodeActuator({
      port: 0,
      health: { enabled: false },
      prometheus: { defaultMetrics: false },
    });
    const port = await actuator.start();
    const res = await fetch(`http://localhost:${port}/actuator/health`);
    expect(res.status).toBe(404);
  });

  test('disabled env does not register /env routes', async () => {
    actuator = new NodeActuator({
      port: 0,
      env: { enabled: false },
      prometheus: { defaultMetrics: false },
    });
    const port = await actuator.start();
    const res = await fetch(`http://localhost:${port}/actuator/env`);
    expect(res.status).toBe(404);
  });

  test('disabled threadDump does not register /threaddump', async () => {
    actuator = new NodeActuator({
      port: 0,
      threadDump: { enabled: false },
      prometheus: { defaultMetrics: false },
    });
    const port = await actuator.start();
    const res = await fetch(`http://localhost:${port}/actuator/threaddump`);
    expect(res.status).toBe(404);
  });

  test('disabled heapDump does not register /heapdump', async () => {
    actuator = new NodeActuator({
      port: 0,
      heapDump: { enabled: false },
      prometheus: { defaultMetrics: false },
    });
    const port = await actuator.start();
    const res = await fetch(`http://localhost:${port}/actuator/heapdump`);
    expect(res.status).toBe(404);
  });

  test('disabled prometheus does not register /prometheus', async () => {
    actuator = new NodeActuator({
      port: 0,
      prometheus: { enabled: false },
    });
    const port = await actuator.start();
    const res = await fetch(`http://localhost:${port}/actuator/prometheus`);
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// Custom basePath
// =============================================================================

describe('NodeActuator — custom basePath', () => {
  test('custom basePath routes work', async () => {
    actuator = new NodeActuator({
      port: 0,
      basePath: '/monitor',
      prometheus: { defaultMetrics: false },
    });
    const port = await actuator.start();

    const res = await fetch(`http://localhost:${port}/monitor`);
    expect(res.status).toBe(200);

    const health = await fetch(`http://localhost:${port}/monitor/health`);
    expect(health.status).toBeDefined();
  });
});

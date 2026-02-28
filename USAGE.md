# Usage Guide

Detailed usage examples for `node-actuator-lite` — a Spring Boot Actuator equivalent for Node.js.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Standalone Mode](#standalone-mode)
- [Serverless Mode](#serverless-mode)
- [Health Checks](#health-checks)
- [Environment](#environment)
- [Thread Dump](#thread-dump)
- [Heap Dump](#heap-dump)
- [Prometheus Metrics](#prometheus-metrics)
- [Express Integration](#express-integration)
- [Fastify Integration](#fastify-integration)
- [Kubernetes Probes](#kubernetes-probes)
- [AWS Lambda](#aws-lambda)
- [Vercel Serverless Functions](#vercel-serverless-functions)
- [Full Configuration Reference](#full-configuration-reference)

---

## Quick Start

```ts
import { NodeActuator } from 'node-actuator-lite';

const actuator = new NodeActuator({ port: 8081 });
await actuator.start();
// Endpoints available at http://localhost:8081/actuator
```

## Standalone Mode

Runs its own lightweight HTTP server on a dedicated port.

```ts
import { NodeActuator } from 'node-actuator-lite';

const actuator = new NodeActuator({
  port: 8081,
  basePath: '/actuator',
  health: {
    showDetails: 'always',
    groups: {
      liveness: ['process'],
      readiness: ['diskSpace', 'database'],
    },
  },
  prometheus: {
    defaultMetrics: true,
    prefix: 'myapp',
  },
});

const port = await actuator.start();
console.log(`Actuator running on port ${port}`);

// Endpoints:
//   GET  /actuator              → Discovery
//   GET  /actuator/health       → Health (deep or shallow)
//   GET  /actuator/health/liveness
//   GET  /actuator/health/readiness
//   GET  /actuator/health/process
//   GET  /actuator/env          → Environment variables
//   GET  /actuator/env/NODE_ENV → Single variable
//   GET  /actuator/threaddump   → Thread dump
//   POST /actuator/heapdump     → Heap dump
//   GET  /actuator/prometheus   → Prometheus metrics

// Graceful shutdown
process.on('SIGTERM', async () => {
  await actuator.stop();
  process.exit(0);
});
```

## Serverless Mode

No HTTP server — use the programmatic API directly.

```ts
import { NodeActuator } from 'node-actuator-lite';

const actuator = new NodeActuator({ serverless: true });
await actuator.start();

// Call methods directly
const health = await actuator.getHealth('always');
const env = actuator.getEnv();
const threadDump = actuator.getThreadDump();
const heapDump = await actuator.getHeapDump();
const prometheus = await actuator.getPrometheus();
const discovery = actuator.discovery();
```

---

## Health Checks

### Shallow vs Deep

```ts
// Shallow — status only, no component details
const shallow = await actuator.getHealth('never');
// → { status: 'UP' }

// Deep — includes per-component breakdown
const deep = await actuator.getHealth('always');
// → { status: 'UP', components: { diskSpace: { status: 'UP', details: {...} }, ... } }
```

### Built-in Indicators

Two indicators are enabled by default:

- **diskSpace** — checks free disk space against a threshold (critical)
- **process** — reports PID, uptime, memory, CPU usage

```ts
const actuator = new NodeActuator({
  serverless: true,
  health: {
    indicators: {
      diskSpace: {
        enabled: true,
        threshold: 50 * 1024 * 1024, // 50 MB minimum free space
        path: '/',                     // Path to check (auto-detected on Windows)
      },
      process: { enabled: true },
    },
  },
});
```

### Custom Health Indicators

```ts
const actuator = new NodeActuator({
  serverless: true,
  health: {
    custom: [
      {
        name: 'database',
        critical: true, // Overall status → DOWN if this fails
        check: async () => {
          try {
            await db.ping();
            return { status: 'UP', details: { responseTime: 12 } };
          } catch (err) {
            return { status: 'DOWN', details: { error: err.message } };
          }
        },
      },
      {
        name: 'redis',
        critical: false,
        check: async () => {
          const info = await redis.info();
          return { status: 'UP', details: { connectedClients: info.clients } };
        },
      },
    ],
  },
});
```

### Runtime Indicator Management

```ts
// Add an indicator after initialization
actuator.health.addIndicator({
  name: 'externalApi',
  critical: false,
  check: async () => {
    const res = await fetch('https://api.example.com/health');
    return { status: res.ok ? 'UP' : 'DOWN' };
  },
});

// Remove an indicator
actuator.health.removeIndicator('externalApi');

// List all indicator names
console.log(actuator.health.indicatorNames());
// → ['diskSpace', 'process', 'database', 'redis']
```

### Health Groups (Kubernetes Probes)

```ts
const actuator = new NodeActuator({
  serverless: true,
  health: {
    groups: {
      liveness: ['process'],                      // /health/liveness
      readiness: ['diskSpace', 'database'],       // /health/readiness
      startup: ['diskSpace', 'database', 'redis'], // /health/startup
    },
  },
});

// Programmatic access
const liveness = await actuator.getHealthGroup('liveness');
// → { status: 'UP', components: { process: { status: 'UP', details: {...} } } }

// Individual component
const db = await actuator.getHealthComponent('database');
// → { status: 'UP', details: { responseTime: 12 } }
```

### Health Timeout

```ts
const actuator = new NodeActuator({
  serverless: true,
  health: {
    timeout: 3000, // 3 seconds — indicators that exceed this return DOWN
  },
});
```

---

## Environment

### Basic Usage

```ts
// Full environment
const env = actuator.getEnv();
// → {
//   activeProfiles: ['production'],
//   propertySources: [
//     { name: 'systemEnvironment', properties: { NODE_ENV: { value: 'production' }, ... } },
//     { name: 'systemProperties', properties: { 'node.version': { value: 'v20.11.0' }, ... } },
//   ]
// }

// Single variable
const nodeEnv = actuator.getEnvVariable('NODE_ENV');
// → { name: 'NODE_ENV', value: 'production' }

// Missing variable
const missing = actuator.getEnvVariable('NONEXISTENT');
// → null
```

### Masking Sensitive Variables

Variables matching patterns are automatically masked:

```ts
const actuator = new NodeActuator({
  serverless: true,
  env: {
    mask: {
      // Default patterns: PASSWORD, SECRET, KEY, TOKEN, AUTH, CREDENTIAL, PRIVATE, SIGNATURE
      patterns: ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'AUTH'],
      additional: ['STRIPE_PUBLISHABLE_KEY', 'INTERNAL_CONFIG'], // Exact variable names
      replacement: '******', // What masked values show as
    },
  },
});

// DB_PASSWORD → '******'
// STRIPE_PUBLISHABLE_KEY → '******'
// NODE_ENV → 'production' (not masked)
```

### Runtime Mask Management

```ts
// Add a new pattern
actuator.env.addMaskPattern('STRIPE');

// Add a specific variable name
actuator.env.addMaskVariable('MY_INTERNAL_VAR');

// Remove a pattern
actuator.env.removeMaskPattern('KEY');

// List current patterns
console.log(actuator.env.getMaskPatterns());
```

---

## Thread Dump

Returns event loop, memory, V8 heap, and active handle/request info.

```ts
const dump = actuator.getThreadDump();

console.log(dump.pid);                  // Process ID
console.log(dump.nodeVersion);          // e.g. 'v20.11.0'
console.log(dump.uptime);              // Seconds
console.log(dump.mainThread.state);    // 'RUNNABLE'
console.log(dump.mainThread.cpuUsage); // { user, system } in microseconds
console.log(dump.mainThread.stackTrace); // Current call stack
console.log(dump.eventLoop.activeHandles); // { count, types }
console.log(dump.eventLoop.activeRequests); // { count, types }
console.log(dump.memory);              // process.memoryUsage()
console.log(dump.v8HeapStats);         // v8.getHeapStatistics()
console.log(dump.v8HeapSpaces);        // v8.getHeapSpaceStatistics()
console.log(dump.workers);             // Worker thread info (if any)
console.log(dump.resourceUsage);       // process.resourceUsage()
```

---

## Heap Dump

Generates a V8 heap snapshot file. **This is a heavy operation** — the HTTP endpoint is `POST` only.

```ts
const result = await actuator.getHeapDump();

console.log(result.filePath);     // e.g. './heapdumps/heapdump-2026-02-28T12-00-00-000Z-a1b2c3d4.heapsnapshot'
console.log(result.fileSize);     // Bytes
console.log(result.duration);     // Milliseconds
console.log(result.memoryBefore); // Memory usage before snapshot
console.log(result.memoryAfter);  // Memory usage after snapshot
```

### Custom Output Directory

```ts
const actuator = new NodeActuator({
  serverless: true,
  heapDump: {
    outputDir: '/tmp/my-heap-dumps',
  },
});
```

Open the `.heapsnapshot` file in Chrome DevTools → Memory → Load for analysis.

---

## Prometheus Metrics

### Default Metrics

```ts
const actuator = new NodeActuator({
  serverless: true,
  prometheus: {
    defaultMetrics: true, // Collects nodejs_* metrics automatically
    prefix: 'myapp',      // Adds prefix label to all metrics
  },
});

const text = await actuator.getPrometheus();
// → Prometheus text exposition format
```

### Custom Metrics

Define metrics in config:

```ts
const actuator = new NodeActuator({
  serverless: true,
  prometheus: {
    defaultMetrics: true,
    customMetrics: [
      { name: 'http_requests_total', help: 'Total HTTP requests', type: 'counter', labels: ['method', 'status'] },
      { name: 'http_request_duration_seconds', help: 'Request duration', type: 'histogram', buckets: [0.01, 0.05, 0.1, 0.5, 1, 5] },
      { name: 'active_connections', help: 'Active connections', type: 'gauge' },
      { name: 'response_size_bytes', help: 'Response sizes', type: 'summary' },
    ],
  },
});
```

Use metrics in your application:

```ts
import { Counter, Histogram, Gauge } from 'prom-client';

const requestCounter = actuator.prometheus.metric<Counter>('http_requests_total')!;
const requestDuration = actuator.prometheus.metric<Histogram>('http_request_duration_seconds')!;
const activeConns = actuator.prometheus.metric<Gauge>('active_connections')!;

// In your middleware
app.use((req, res, next) => {
  activeConns.inc();
  const end = requestDuration.startTimer();

  res.on('finish', () => {
    activeConns.dec();
    end({ method: req.method, status: String(res.statusCode) });
    requestCounter.inc({ method: req.method, status: String(res.statusCode) });
  });

  next();
});
```

### Runtime Metric Management

```ts
// Register at runtime
const gauge = actuator.prometheus.registerMetric({
  name: 'queue_depth',
  help: 'Message queue depth',
  type: 'gauge',
});

// Remove
actuator.prometheus.removeMetric('queue_depth');

// Access the underlying prom-client Registry
const registry = actuator.prometheus.getRegistry();

// Reset all metrics (useful in tests)
await actuator.prometheus.reset();
```

---

## Express Integration

```ts
import express from 'express';
import { NodeActuator } from 'node-actuator-lite';

const app = express();
const actuator = new NodeActuator({ serverless: true, prometheus: { defaultMetrics: true } });
await actuator.start();

// Mount all actuator endpoints
app.get('/actuator', (_, res) => res.json(actuator.discovery()));
app.get('/actuator/health', async (req, res) => {
  const result = await actuator.getHealth(req.query.showDetails as string);
  res.status(result.status === 'UP' ? 200 : 503).json(result);
});
app.get('/actuator/health/:name', async (req, res) => {
  const group = await actuator.getHealthGroup(req.params.name);
  if (group) return res.status(group.status === 'UP' ? 200 : 503).json(group);
  const comp = await actuator.getHealthComponent(req.params.name);
  if (comp) return res.status(comp.status === 'UP' ? 200 : 503).json(comp);
  res.status(404).json({ error: 'Not found' });
});
app.get('/actuator/env', (_, res) => res.json(actuator.getEnv()));
app.get('/actuator/env/:name', (req, res) => {
  const v = actuator.getEnvVariable(req.params.name);
  v ? res.json(v) : res.status(404).json({ error: 'Not found' });
});
app.get('/actuator/threaddump', (_, res) => res.json(actuator.getThreadDump()));
app.post('/actuator/heapdump', async (_, res) => res.json(await actuator.getHeapDump()));
app.get('/actuator/prometheus', async (_, res) => {
  res.set('Content-Type', 'text/plain; charset=utf-8').send(await actuator.getPrometheus());
});

app.listen(3000);
```

## Fastify Integration

```ts
import Fastify from 'fastify';
import { NodeActuator } from 'node-actuator-lite';

const fastify = Fastify();
const actuator = new NodeActuator({ serverless: true });
await actuator.start();

fastify.get('/actuator', async () => actuator.discovery());
fastify.get('/actuator/health', async (req, reply) => {
  const result = await actuator.getHealth((req.query as any).showDetails);
  reply.code(result.status === 'UP' ? 200 : 503).send(result);
});
fastify.get('/actuator/env', async () => actuator.getEnv());
fastify.get('/actuator/threaddump', async () => actuator.getThreadDump());
fastify.post('/actuator/heapdump', async () => actuator.getHeapDump());
fastify.get('/actuator/prometheus', async (_, reply) => {
  reply.type('text/plain').send(await actuator.getPrometheus());
});

await fastify.listen({ port: 3000 });
```

---

## Kubernetes Probes

### Pod Spec (Standalone Mode)

```yaml
# The actuator runs on port 8081
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: app
      ports:
        - containerPort: 3000
        - containerPort: 8081
      livenessProbe:
        httpGet:
          path: /actuator/health/liveness
          port: 8081
        initialDelaySeconds: 5
        periodSeconds: 10
      readinessProbe:
        httpGet:
          path: /actuator/health/readiness
          port: 8081
        initialDelaySeconds: 10
        periodSeconds: 5
      startupProbe:
        httpGet:
          path: /actuator/health/startup
          port: 8081
        failureThreshold: 30
        periodSeconds: 2
```

### Node.js Config

```ts
const actuator = new NodeActuator({
  port: 8081,
  health: {
    showDetails: 'always',
    custom: [
      {
        name: 'database',
        critical: true,
        check: async () => {
          await db.ping();
          return { status: 'UP' };
        },
      },
    ],
    groups: {
      liveness: ['process'],
      readiness: ['diskSpace', 'database'],
      startup: ['diskSpace', 'database'],
    },
  },
});
await actuator.start();
```

---

## AWS Lambda

```ts
import { NodeActuator } from 'node-actuator-lite';

const actuator = new NodeActuator({ serverless: true });
await actuator.start();

export async function handler(event: any) {
  const path = event.path || event.rawPath;

  if (path === '/actuator/health') {
    const health = await actuator.getHealth(event.queryStringParameters?.showDetails);
    return { statusCode: health.status === 'UP' ? 200 : 503, body: JSON.stringify(health) };
  }

  if (path === '/actuator/env') {
    return { statusCode: 200, body: JSON.stringify(actuator.getEnv()) };
  }

  if (path === '/actuator/threaddump') {
    return { statusCode: 200, body: JSON.stringify(actuator.getThreadDump()) };
  }

  if (path === '/actuator/prometheus') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: await actuator.getPrometheus(),
    };
  }

  return { statusCode: 200, body: JSON.stringify(actuator.discovery()) };
}
```

## Vercel Serverless Functions

```ts
// api/actuator/health.ts
import { NodeActuator } from 'node-actuator-lite';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const actuator = new NodeActuator({ serverless: true });
actuator.start();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const health = await actuator.getHealth(req.query.showDetails as string);
  res.status(health.status === 'UP' ? 200 : 503).json(health);
}
```

---

## Full Configuration Reference

```ts
const actuator = new NodeActuator({
  // Server
  port: 8081,               // Port for standalone server (0 = random, default: 0)
  basePath: '/actuator',    // URL prefix for all endpoints (default: '/actuator')
  serverless: false,        // Skip HTTP server, use programmatic API only (default: false)

  // Health
  health: {
    enabled: true,            // Enable health endpoint (default: true)
    showDetails: 'always',    // 'always' | 'never' — can be overridden per-request via ?showDetails= (default: 'always')
    timeout: 5000,            // Per-indicator timeout in ms (default: 5000)
    indicators: {
      diskSpace: {
        enabled: true,        // Enable disk space check (default: true)
        threshold: 10485760,  // Minimum free bytes to be healthy (default: 10MB)
        path: '/',            // Filesystem path to check (default: '/' or drive root on Windows)
      },
      process: {
        enabled: true,        // Enable process info check (default: true)
      },
    },
    groups: {                 // Health groups — accessible at /health/{groupName}
      liveness: ['process'],
      readiness: ['diskSpace', 'database'],
    },
    custom: [                 // Custom health indicators
      {
        name: 'database',
        critical: true,       // If DOWN, forces overall status to DOWN (default: false)
        check: async () => ({ status: 'UP', details: { latency: 5 } }),
      },
    ],
  },

  // Environment
  env: {
    enabled: true,            // Enable env endpoint (default: true)
    mask: {
      patterns: ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'AUTH', 'CREDENTIAL', 'PRIVATE', 'SIGNATURE'],
      additional: [],         // Exact variable names to mask
      replacement: '******',  // Replacement string for masked values
    },
  },

  // Thread Dump
  threadDump: {
    enabled: true,            // Enable threaddump endpoint (default: true)
  },

  // Heap Dump
  heapDump: {
    enabled: true,            // Enable heapdump endpoint (default: true)
    outputDir: './heapdumps', // Directory for snapshot files (default: './heapdumps')
  },

  // Prometheus
  prometheus: {
    enabled: true,            // Enable prometheus endpoint (default: true)
    defaultMetrics: true,     // Collect Node.js default metrics (default: true)
    prefix: '',               // Label prefix for all metrics (default: '')
    customMetrics: [],        // Custom metric definitions (see Prometheus section above)
  },
});
```

---

## Programmatic API Summary

| Method | Returns | Description |
|--------|---------|-------------|
| `actuator.start()` | `Promise<number>` | Start the actuator. Returns port (0 in serverless mode). |
| `actuator.stop()` | `Promise<void>` | Stop the HTTP server. |
| `actuator.getPort()` | `number` | Current port (0 if serverless). |
| `actuator.discovery()` | `DiscoveryResponse` | List all enabled endpoints. |
| `actuator.getHealth(showDetails?)` | `Promise<HealthResponse>` | Overall health. |
| `actuator.getHealthComponent(name)` | `Promise<HealthComponentResponse \| null>` | Single component health. |
| `actuator.getHealthGroup(name)` | `Promise<HealthResponse \| null>` | Health group aggregation. |
| `actuator.getEnv()` | `EnvResponse` | All environment data. |
| `actuator.getEnvVariable(name)` | `{ name, value } \| null` | Single env variable. |
| `actuator.getThreadDump()` | `ThreadDumpResponse` | Thread/event loop info. |
| `actuator.getHeapDump()` | `Promise<HeapDumpResponse>` | Generate heap snapshot. |
| `actuator.getPrometheus()` | `Promise<string>` | Prometheus text metrics. |

### Direct Collector Access

| Property | Type | Description |
|----------|------|-------------|
| `actuator.health` | `HealthCollector` | Add/remove indicators, run checks |
| `actuator.env` | `EnvironmentCollector` | Manage mask patterns |
| `actuator.prometheus` | `PrometheusCollector` | Register/remove metrics, access registry |
| `actuator.threadDump` | `ThreadDumpCollector` | Collect thread info |
| `actuator.heapDump` | `HeapDumpCollector` | Generate snapshots |

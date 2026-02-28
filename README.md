# Node Actuator Lite

[![npm version](https://badge.fury.io/js/node-actuator-lite.svg)](https://badge.fury.io/js/node-actuator-lite)
[![npm downloads](https://img.shields.io/npm/dm/node-actuator-lite.svg)](https://www.npmjs.com/package/node-actuator-lite)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Spring Boot Actuator for Node.js — production-ready monitoring endpoints with a single dependency.

## Features

- **Health** — shallow (status only) and deep (per-component details), custom indicators, health groups (liveness / readiness)
- **Environment** — `process.env` with automatic sensitive-value masking
- **Thread Dump** — event loop state, active handles/requests, V8 heap stats, worker threads
- **Heap Dump** — V8 heap snapshots saved to disk
- **Prometheus** — all default Node.js metrics + custom counters, gauges, histograms, summaries via `prom-client`
- **Discovery** — `GET /actuator` lists all enabled endpoints (like Spring Boot)
- **Dual mode** — standalone HTTP server *or* serverless (direct method calls, no port needed)
- **Single runtime dependency** — `prom-client`

## Installation

```bash
npm install node-actuator-lite
```

> Requires **Node.js >= 18**.

## Quick Start

### Standalone (HTTP server)

```typescript
import { NodeActuator } from 'node-actuator-lite';

const actuator = new NodeActuator({
  port: 8081,
  health: {
    showDetails: 'always',
    custom: [
      {
        name: 'database',
        critical: true,
        check: async () => ({ status: 'UP', details: { latency: '2ms' } }),
      },
    ],
    groups: {
      liveness: ['process'],
      readiness: ['diskSpace', 'database'],
    },
  },
  prometheus: {
    customMetrics: [
      { name: 'http_requests_total', help: 'Total HTTP requests', type: 'counter', labels: ['method', 'path'] },
    ],
  },
});

await actuator.start();
// Actuator listening on http://localhost:8081/actuator
```

### Serverless (Vercel, Lambda, etc.)

```typescript
import { NodeActuator } from 'node-actuator-lite';

const actuator = new NodeActuator({ serverless: true });
await actuator.start(); // no-op, no server started

const health  = await actuator.getHealth();          // shallow
const deep    = await actuator.getHealth('always');   // deep
const prom    = await actuator.getPrometheus();
const env     = actuator.getEnv();
const threads = actuator.getThreadDump();
const heap    = await actuator.getHeapDump();
```

## Endpoints

All endpoints live under the configured `basePath` (default `/actuator`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/actuator` | Discovery — lists all enabled endpoints |
| GET | `/actuator/health` | Health check (shallow or deep based on config) |
| GET | `/actuator/health?showDetails=always` | Force deep health check |
| GET | `/actuator/health/{component}` | Single health component |
| GET | `/actuator/health/{group}` | Health group (e.g. `liveness`, `readiness`) |
| GET | `/actuator/env` | Environment variables (masked) |
| GET | `/actuator/env/{name}` | Single environment variable |
| GET | `/actuator/threaddump` | Thread / event-loop dump |
| POST | `/actuator/heapdump` | Generate and save a V8 heap snapshot |
| GET | `/actuator/prometheus` | Prometheus metrics (text exposition format) |

## Configuration

```typescript
interface ActuatorOptions {
  port?: number;            // default 0 (random)
  basePath?: string;        // default '/actuator'
  serverless?: boolean;     // default false

  health?: {
    enabled?: boolean;                  // default true
    showDetails?: 'never' | 'always';   // default 'always'
    timeout?: number;                   // per-indicator timeout in ms, default 5000
    indicators?: {
      diskSpace?: { enabled?: boolean; threshold?: number; path?: string };
      process?: { enabled?: boolean };
    };
    groups?: Record<string, string[]>;  // e.g. { liveness: ['process'], readiness: ['diskSpace', 'db'] }
    custom?: Array<{
      name: string;
      check: () => Promise<{ status: 'UP' | 'DOWN' | 'OUT_OF_SERVICE' | 'UNKNOWN'; details?: Record<string, any> }>;
      critical?: boolean;               // if true, DOWN here → overall DOWN
    }>;
  };

  env?: {
    enabled?: boolean;      // default true
    mask?: {
      patterns?: string[];    // default ['PASSWORD','SECRET','KEY','TOKEN','AUTH','CREDENTIAL','PRIVATE','SIGNATURE']
      additional?: string[];  // extra variable names to mask
      replacement?: string;   // default '******'
    };
  };

  threadDump?: { enabled?: boolean };   // default true

  heapDump?: {
    enabled?: boolean;      // default true
    outputDir?: string;     // default './heapdumps'
  };

  prometheus?: {
    enabled?: boolean;      // default true
    defaultMetrics?: boolean; // collect default Node.js metrics, default true
    prefix?: string;
    customMetrics?: Array<{
      name: string;
      help: string;
      type: 'counter' | 'gauge' | 'histogram' | 'summary';
      labels?: string[];
      buckets?: number[];   // histogram only
    }>;
  };
}
```

## Health — Shallow vs Deep

**Shallow** (`showDetails: 'never'` or default `GET /actuator/health`):

```json
{ "status": "UP" }
```

**Deep** (`showDetails: 'always'` or `GET /actuator/health?showDetails=always`):

```json
{
  "status": "UP",
  "components": {
    "diskSpace": {
      "status": "UP",
      "details": { "total": 499963174912, "free": 250000000000, "threshold": 10485760, "path": "/" }
    },
    "process": {
      "status": "UP",
      "details": { "pid": 12345, "uptime": 3600, "version": "v20.11.0" }
    },
    "database": {
      "status": "UP",
      "details": { "latency": "2ms" }
    }
  }
}
```

### Health Groups

Model Kubernetes liveness and readiness probes:

```typescript
const actuator = new NodeActuator({
  health: {
    groups: {
      liveness: ['process'],
      readiness: ['diskSpace', 'database'],
    },
  },
});
```

- `GET /actuator/health/liveness` → aggregated status of `process` only
- `GET /actuator/health/readiness` → aggregated status of `diskSpace` + `database`

Returns HTTP **200** when UP, **503** when DOWN.

### Custom Health Indicators

```typescript
const actuator = new NodeActuator({
  health: {
    custom: [
      {
        name: 'redis',
        critical: true,
        check: async () => {
          const ok = await redis.ping();
          return ok
            ? { status: 'UP', details: { latency: '1ms' } }
            : { status: 'DOWN', details: { error: 'ping failed' } };
        },
      },
    ],
  },
});
```

Add/remove at runtime:

```typescript
actuator.health.addIndicator({ name: 'cache', check: async () => ({ status: 'UP' }) });
actuator.health.removeIndicator('cache');
```

## Environment

The `/env` endpoint returns a Spring-style property-source response:

```json
{
  "activeProfiles": ["production"],
  "propertySources": [
    {
      "name": "systemEnvironment",
      "properties": {
        "PATH": { "value": "/usr/local/bin:..." },
        "DATABASE_PASSWORD": { "value": "******" }
      }
    },
    {
      "name": "systemProperties",
      "properties": {
        "node.version": { "value": "v20.11.0" },
        "os.hostname": { "value": "my-server" }
      }
    }
  ]
}
```

### Masking

Sensitive values are masked by default. Customise patterns:

```typescript
const actuator = new NodeActuator({
  env: {
    mask: {
      patterns: ['PASSWORD', 'SECRET', 'KEY', 'TOKEN'],
      additional: ['MY_CUSTOM_VAR'],
      replacement: '[REDACTED]',
    },
  },
});
```

Runtime management:

```typescript
actuator.env.addMaskPattern('STRIPE');
actuator.env.addMaskVariable('SPECIAL_KEY');
actuator.env.removeMaskPattern('KEY');
```

## Prometheus

Default Node.js metrics (CPU, memory, event loop lag, GC, etc.) are collected automatically. Add custom metrics:

```typescript
const actuator = new NodeActuator({
  prometheus: {
    customMetrics: [
      { name: 'http_requests_total', help: 'Total requests', type: 'counter', labels: ['method', 'status'] },
      { name: 'request_duration_seconds', help: 'Request duration', type: 'histogram', buckets: [0.01, 0.05, 0.1, 0.5, 1] },
      { name: 'active_connections', help: 'Active connections', type: 'gauge' },
    ],
  },
});

await actuator.start();

// Use metrics
const counter = actuator.prometheus.metric('http_requests_total');
counter.inc({ method: 'GET', status: '200' });

const gauge = actuator.prometheus.metric('active_connections');
gauge.set(42);
```

Access the raw `prom-client` registry:

```typescript
actuator.prometheus.getRegistry();
```

## Thread Dump

`GET /actuator/threaddump` returns:

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "pid": 12345,
  "nodeVersion": "v20.11.0",
  "platform": "linux",
  "uptime": 3600,
  "mainThread": { "name": "main", "state": "RUNNABLE", "cpuUsage": { "user": 500000, "system": 100000 } },
  "eventLoop": {
    "activeHandles": { "count": 5, "types": ["Server", "Socket", "Timer"] },
    "activeRequests": { "count": 0, "types": [] }
  },
  "workers": [],
  "memory": { "rss": 52428800, "heapTotal": 20971520, "heapUsed": 15728640, "external": 1048576 },
  "v8HeapStats": { "total_heap_size": 20971520, "used_heap_size": 15728640, "..." : "..." }
}
```

## Heap Dump

`POST /actuator/heapdump` generates a V8 heap snapshot and saves it to disk:

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "pid": 12345,
  "filePath": "./heapdumps/heapdump-2025-01-15T10-30-00-000Z-a1b2c3d4.heapsnapshot",
  "fileSize": 15728640,
  "duration": 1250,
  "memoryBefore": { "heapUsed": 15728640 },
  "memoryAfter": { "heapUsed": 16777216 }
}
```

Open the `.heapsnapshot` file in Chrome DevTools → Memory → Load.

## Serverless Integration

### Vercel

```javascript
// api/actuator/[...path].js
import { NodeActuator } from 'node-actuator-lite';

const actuator = new NodeActuator({ serverless: true });

export default async function handler(req, res) {
  const segments = req.query['...path'];
  const path = Array.isArray(segments) ? segments.join('/') : segments || '';

  switch (path) {
    case '':
      return res.json(actuator.discovery());
    case 'health':
      return res.json(await actuator.getHealth());
    case 'env':
      return res.json(actuator.getEnv());
    case 'threaddump':
      return res.json(actuator.getThreadDump());
    case 'prometheus':
      res.setHeader('Content-Type', 'text/plain');
      return res.send(await actuator.getPrometheus());
    default:
      return res.status(404).json({ error: 'Not found' });
  }
}
```

### AWS Lambda

```typescript
import { NodeActuator } from 'node-actuator-lite';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const actuator = new NodeActuator({ serverless: true });

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.pathParameters?.proxy || '';

  const routes: Record<string, () => Promise<{ code: number; type: string; body: string }>> = {
    health: async () => ({ code: 200, type: 'application/json', body: JSON.stringify(await actuator.getHealth()) }),
    env: async () => ({ code: 200, type: 'application/json', body: JSON.stringify(actuator.getEnv()) }),
    prometheus: async () => ({ code: 200, type: 'text/plain', body: await actuator.getPrometheus() }),
    threaddump: async () => ({ code: 200, type: 'application/json', body: JSON.stringify(actuator.getThreadDump()) }),
  };

  const route = routes[path];
  if (!route) return { statusCode: 404, body: '{"error":"Not found"}' };

  const result = await route();
  return { statusCode: result.code, headers: { 'Content-Type': result.type }, body: result.body };
};
```

## Programmatic API

All data is available via methods — no HTTP server required.

```typescript
const actuator = new NodeActuator({ serverless: true });

// Discovery
actuator.discovery();

// Health
await actuator.getHealth();                  // shallow or deep (based on config)
await actuator.getHealth('always');           // force deep
await actuator.getHealthComponent('diskSpace');
await actuator.getHealthGroup('readiness');

// Environment
actuator.getEnv();
actuator.getEnvVariable('NODE_ENV');

// Thread dump
actuator.getThreadDump();

// Heap dump
await actuator.getHeapDump();

// Prometheus
await actuator.getPrometheus();
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## License

MIT — see [LICENSE](./LICENSE).

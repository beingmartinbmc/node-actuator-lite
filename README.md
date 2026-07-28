# Node Actuator Lite

[![CI](https://github.com/beingmartinbmc/node-actuator-lite/actions/workflows/ci.yml/badge.svg)](https://github.com/beingmartinbmc/node-actuator-lite/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/node-actuator-lite.svg)](https://www.npmjs.com/package/node-actuator-lite)
[![npm downloads](https://img.shields.io/npm/dm/node-actuator-lite.svg)](https://www.npmjs.com/package/node-actuator-lite)
[![node](https://img.shields.io/node/v/node-actuator-lite.svg)](https://www.npmjs.com/package/node-actuator-lite)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Spring Boot Actuator, for Node.js.** Production health checks, Prometheus metrics, environment inspection, thread and heap dumps, and runtime log-level changes — one runtime dependency, and a dashboard you can open in a browser.

<p align="center">
  <img src="https://raw.githubusercontent.com/beingmartinbmc/node-actuator-lite/main/assets/banner.png" alt="node-actuator-lite — Spring Boot Actuator for Node.js" width="900" />
</p>

```bash
npm install node-actuator-lite
```

```typescript
import express from 'express';
import { actuatorMiddleware } from 'node-actuator-lite';

const app = express();
app.use(actuatorMiddleware().handler);

app.listen(3000); // every /actuator/* endpoint is now live
```

That is the entire setup. Requires **Node.js 18 or newer**, works with both `require` and `import`, and pulls in exactly one runtime dependency (`prom-client`).

## The dashboard is the part you can't get elsewhere

<p align="center">
  <img src="https://raw.githubusercontent.com/beingmartinbmc/node-actuator-lite/main/assets/dashboard.png" alt="The node-actuator-lite dashboard showing health, info, memory, process, and endpoint cards" width="900" />
</p>

`GET /actuator/dashboard` serves that page from the library itself — a single HTML document with inline CSS and JS, no CDN calls, no build step, no external assets. It auto-refreshes every five seconds and pauses when the tab is backgrounded. Useful for eyeballing a service long before you stand up Grafana.

## Three things you can do that most health-check libraries don't

**Change a log level in production without redeploying.**

```bash
curl -X POST http://localhost:8081/actuator/loggers/ROOT \
  -H 'Content-Type: application/json' -d '{"configuredLevel":"DEBUG"}'
```

Adapters ship for Pino, Winston, and Bunyan.

**Take a heap snapshot over HTTP**, streamed to disk without blocking the event loop, throttled to one per minute. Open the result in Chrome DevTools → Memory → Load.

```bash
curl -X POST http://localhost:8081/actuator/heapdump
```

**Inspect the environment safely.** `GET /actuator/env` returns Spring-style property sources with secrets masked. Connection strings keep their host and database name visible and mask only the password, so `postgres://app:hunter2@db:5432/orders` reads back as `postgres://app:******@db:5432/orders`.

## How it compares

|                                    | node-actuator-lite | @godaddy/terminus | lightship | express-actuator |
| ---------------------------------- | :----------------: | :---------------: | :-------: | :--------------: |
| Health checks                      |         Yes        |        Yes        |    Yes    |        Yes       |
| Kubernetes liveness / readiness    |         Yes        |        Yes        |    Yes    |         —        |
| Prometheus endpoint                |         Yes        |         —         |     —     |         —        |
| Environment inspection with masking|         Yes        |         —         |     —     |         —        |
| Thread / event-loop dump           |         Yes        |         —         |     —     |         —        |
| Heap dump over HTTP                |         Yes        |         —         |     —     |         —        |
| Runtime log-level changes          |         Yes        |         —         |     —     |         —        |
| Built-in dashboard                 |         Yes        |         —         |     —     |         —        |
| Graceful shutdown                  |          —         |        Yes        |    Yes    |         —        |
| Framework support                  | Express, Fastify, Koa, `node:http`, serverless | Any `http` server | Any | Express only |
| Runtime dependencies               |          1         |         1         |     4     |         2        |

If graceful shutdown is the only thing you need, [`@godaddy/terminus`](https://github.com/godaddy/terminus) does that one job well and this library does not compete with it — the two compose fine.

## Endpoints

All paths are relative to `basePath` (default `/actuator`), and each appears in discovery only when enabled.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/actuator` | Discovery — lists every enabled endpoint |
| GET | `/actuator/dashboard` | Self-contained HTML dashboard |
| GET | `/actuator/health` | Health check, shallow or deep |
| GET | `/actuator/health/{component\|group}` | One component, or a group such as `liveness` |
| GET | `/actuator/info` | Build and runtime information |
| GET | `/actuator/metrics` | Process CPU, memory, and uptime as JSON |
| GET | `/actuator/env` | Environment variables, masked |
| GET | `/actuator/env/{name}` | A single environment variable |
| GET | `/actuator/threaddump` | Event loop, active handles, V8 heap, workers |
| POST | `/actuator/heapdump` | Write a V8 heap snapshot to disk |
| GET | `/actuator/prometheus` | Prometheus text exposition format |
| GET | `/actuator/loggers` | List loggers and their levels |
| POST | `/actuator/loggers/{name}` | Change a logger's level at runtime |

## Production safety

These endpoints expose operational data, so treat them like any other admin surface. Use the `production` preset, an `auth` callback, or both.

```typescript
import { NodeActuator } from 'node-actuator-lite';

const actuator = new NodeActuator({
  port: 8081,
  preset: 'production',
  auth: ({ raw }) => raw.headers.authorization === `Bearer ${process.env.OPS_TOKEN}`,
  health: {
    groups: { liveness: ['process'], readiness: ['diskSpace', 'database'] },
  },
});

await actuator.start();
```

The `production` preset keeps `/health` (shallow), `/info`, `/metrics`, and `/prometheus`, and disables `/env`, `/threaddump`, `/heapdump`, `/loggers`, and `/dashboard`. Individual endpoints can still be re-enabled explicitly.

The preset is **never inferred from `NODE_ENV`**. Upgrading this library can't silently disable an endpoint your deployment relies on — if `NODE_ENV=production` is set without a preset, you get a warning suggesting one, not a behaviour change.

## Framework adapters

```typescript
// Express / Connect
import { actuatorMiddleware } from 'node-actuator-lite';
app.use(actuatorMiddleware().handler);

// Fastify
import { actuatorPlugin } from 'node-actuator-lite';
await app.register(actuatorPlugin);

// Koa
import { actuatorKoa } from 'node-actuator-lite/middleware/koa';
app.use(actuatorKoa().middleware);

// node:http — requests outside basePath fall through to next()
import { actuatorHttp } from 'node-actuator-lite/middleware/http';
http.createServer(actuatorHttp().handler).listen(8080);
```

In serverless mode no server is started and you call the data methods directly, which suits Vercel and Lambda:

```typescript
const actuator = new NodeActuator({ serverless: true });

await actuator.getHealth();     // shallow; pass 'always' to force deep
await actuator.getInfoAsync();
await actuator.getPrometheus();
actuator.getMetrics();
actuator.getEnv();
```

## Documentation

- **[USAGE.md](./USAGE.md)** — the full guide: every configuration option, custom health indicators, health groups, masking rules, custom Prometheus metrics, logger adapters, Kubernetes probe specs, and the complete programmatic API.
- **[examples/](./examples)** — runnable Express, Fastify, Lambda, and Kubernetes examples.
- **[src/core/types.ts](./src/core/types.ts)** — the authoritative `ActuatorOptions` shape.

## Ecosystem

Adopt these independently or together:

- [`node-eventloop-watchdog`](https://github.com/beingmartinbmc/node-eventloop-watchdog) — detects event-loop stalls and captures stack traces. Registers `/actuator/eventloop*` automatically when both are installed.
- [`node-request-trace`](https://github.com/beingmartinbmc/node-request-trace) — per-request timelines without OpenTelemetry.
- [`node-observability-lite`](https://github.com/beingmartinbmc/node-observability-lite) — wires all three together with production-safe presets in one line.

## Contributing

[CONTRIBUTING.md](./CONTRIBUTING.md) covers development setup and release checks. Report security issues privately as described in [SECURITY.md](./SECURITY.md). Release notes live in [CHANGELOG.md](./CHANGELOG.md).

## License

MIT — see [LICENSE](./LICENSE).

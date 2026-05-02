# Ecosystem Example

This example wires `node-actuator-lite`, `node-eventloop-watchdog`, and `node-request-trace` together in a single Express app to give you health, metrics, request timelines, and event-loop protection without OpenTelemetry or external infrastructure.

## Run

```bash
cd examples/ecosystem
npm install
ACTUATOR_TOKEN=dev-token npm start
```

## Endpoints

All ops endpoints are protected by a bearer token (`ACTUATOR_TOKEN`).

### Actuator

```bash
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator/health
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator/info
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator/metrics
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator/prometheus
```

### Event-loop watchdog

`node-eventloop-watchdog` auto-registers these under the actuator when both packages are installed:

```bash
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator/eventloop
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator/eventloop/history
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator/eventloop/hotspots
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator/eventloop/metrics
```

The example also installs an `eventLoop` health indicator. It marks the app `DOWN` when block frequency or peak lag crosses a threshold, and is part of both the `liveness` and `readiness` health groups.

### Request trace

```bash
# Browser dashboard
open http://localhost:3000/trace/ui

# JSON
curl -H "Authorization: Bearer dev-token" http://localhost:3000/trace/recent
curl -H "Authorization: Bearer dev-token" http://localhost:3000/trace/slow
curl -H "Authorization: Bearer dev-token" http://localhost:3000/trace/stats

# Custom actuator endpoint backed by trace storage
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator/traces/stats
```

## Demo routes

```bash
curl http://localhost:3000/work    # small traced workload
curl http://localhost:3000/slow    # 250ms request, exceeds slowThreshold
curl http://localhost:3000/stall   # synchronously blocks the event loop for 200ms
```

After hitting `/stall` a few times, look at:

- `/actuator/eventloop/history` for recent block events with stack traces and the originating request route.
- `/trace/ui` for per-request timelines and bottleneck detection.
- `/actuator/health` to see the `eventLoop` indicator react if blocks pile up.

## What this example demonstrates

- One-line wiring of three independent packages into a unified observability surface.
- Cross-package integration: watchdog block events automatically include the active request id, route, and method captured by `node-request-trace`.
- Custom actuator endpoints, info contributors, and health indicators powered by ecosystem data.
- Production-safe defaults: env, thread dump, and heap dump are disabled; ops routes are bearer-token protected.

# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses semantic versioning.

## 4.1.0 - 2026-07-28

### Changed

- **Node.js 18 and 20 are supported again.** `engines.node` is back to `>=18.0.0`. 4.0.0 raised the floor to 22 because the test suite intermittently hung on Node 18/20, but that hang was a test-harness bug rather than a runtime incompatibility — see Fixed. The library was verified against Node 18.20.8, 20.19.5, 22.23.1, and 24.15.0: full suite green (380 tests) on all four, plus a runtime check of the programmatic API, standalone server, `node:http` adapter, Express middleware, and the heap-dump path against a packed tarball.

### Fixed

- A stalled `v8.getHeapSnapshot()` stream no longer hangs `HeapDumpCollector.collect()` forever. The stream is now piped under an abort signal and falls back to the synchronous writer if it produces nothing within 60 seconds. Previously such a stall never rejected, so the `finally` that clears `inProgress` never ran and **every subsequent heap dump was rejected with "A heap dump is already in progress" for the remaining life of the process**.
- `tests/security-features.test.ts` mocked `v8.writeHeapSnapshot` but not `v8.getHeapSnapshot`, so its heap-dump throttling tests exercised the real V8 streaming snapshot. That stalled indefinitely inside a jest worker on Node 20 and failed on Node 22. Both snapshot APIs are now mocked, matching `tests/heap-dump-collector.test.ts`. This also removes the leaked handle that made the suite require `--forceExit`, and cuts the full run from roughly 60 seconds to under 3.

### Documentation

- README rewritten from 792 lines to 171: leads with the pitch and a real screenshot of the dashboard, adds a factual comparison against `@godaddy/terminus`, `lightship`, and `express-actuator` (including what they do better), and defers the full option reference to `USAGE.md` instead of duplicating it.
- Removed the incorrect note claiming ESM consumers need a bundler or a future dual build. Named ESM imports already resolve through Node's CommonJS interop and are verified in a `type: module` package.
- Added `assets/dashboard.png`, a real screenshot of `/actuator/dashboard`, and `assets/social-preview.png` at GitHub's 1280x640 social-preview size. `assets/banner.png` was recompressed from 1.63 MB to 340 KB so it fits under GitHub's 1 MB social-preview upload limit.

## 4.0.0 - 2026-07-06

### Added

- `preset: 'production'` safety preset that disables `/env`, `/threaddump`, `/heapdump`, `/loggers`, and `/dashboard`, and hides health details, by default. Must be set explicitly — it is never inferred from `NODE_ENV`.
- `/actuator/loggers` (list) and `/actuator/loggers/{name}` (get/change level) endpoints, with `PinoLoggerAdapter`, `WinstonLoggerAdapter`, and `BunyanLoggerAdapter` for managing external loggers alongside the built-in `ROOT` logger.
- `prometheus.registry` option to inject an existing `prom-client` `Registry` instead of creating a new one.
- Event Loop Utilization (ELU) reported at `threaddump.eventLoop.utilization` (idle/active/utilization plus the delta since the previous call).
- Smart connection-string masking for `/actuator/env`: password-bearing URIs (Postgres, MySQL, MongoDB, Redis, AMQP, etc.) have only the credential masked, keeping host, port, and database visible.
- CI `release-checks` job (typecheck, build, package smoke test, production dependency audit, pack dry run) runs on every PR.

### Changed

- **Breaking:** minimum supported Node.js version raised from 18 to **22**. CI matrix now tests 22 and 24 only; `@types/node` bumped to match. Node 18/20 CI runs were dropped after both intermittently hung on `HeapDumpCollector`'s stream error path (see Fixed).
- `/actuator` dispatch uses a cached, pre-compiled endpoint table instead of rebuilding routes and regexes on every request.
- `HealthCollector` stores indicators in a `Map` instead of an array for O(1) lookups; health-group checks now run in parallel.
- Heap dumps are generated asynchronously via a streamed `v8.getHeapSnapshot()` instead of the event-loop-blocking `v8.writeHeapSnapshot()`, with a synchronous fallback if streaming fails.
- `prometheus.prefix` is now prepended to metric names (the Prometheus convention) instead of being applied as a registry default label.
- Express, Koa, and `node:http` adapters use a strict base-path match so `/actuator` no longer matches lookalike paths such as `/actuatorish`.
- Express, Fastify, Koa, and `node:http` adapters send `Cache-Control: no-store` on every actuator response.
- The built-in dashboard pauses its polling loop while the browser tab is hidden.
- A warning is now logged when `NODE_ENV=production` is detected without an explicit `preset`, and another when sensitive endpoints are enabled without an `auth` callback.

### Fixed

- `POST /actuator/loggers/{name}` now works on the standalone server and the `node:http` adapter. Both now parse JSON request bodies — previously `ctx.body` was always `undefined` outside the Express/Fastify/Koa adapters, so every request failed with `configuredLevel is required`.
- `LoggerLevel.OFF` now truly silences Winston (`silent: true`) and Bunyan (level set above `FATAL`) instead of mapping to `error`/`fatal`, which still emitted logs at severe levels.
- `HeapDumpCollector`'s async snapshot write now uses `stream/promises`' `pipeline()` instead of manual `.pipe()` + event listeners, fixing inconsistent error propagation when the `v8.getHeapSnapshot()` stream errors (could resolve as if the write had succeeded, or hang, depending on Node version).

### Documentation

- Documented the `loggers`, `preset`, and `prometheus.registry` options, connection-string masking, and Event Loop Utilization across `README.md` and `USAGE.md`; updated `SECURITY.md` and `CONTRIBUTING.md` to list `/loggers` alongside the other sensitive endpoints.
- The README banner now loads from a raw GitHub URL instead of a repo-relative path, so it renders correctly on npmjs.com; the image is no longer included in the published npm package.

## 3.3.1 - 2026-06-21

### Documentation

- Rewrote the README in a single consistent voice and brought it up to date with the 3.3.0 surface: Koa and `node:http` adapters, the built-in HTML dashboard, `/info` and `/metrics` endpoints, custom endpoint registration, the `auth` callback, pluggable logger, and the `env` allowlist and heap-dump throttling options.

### Fixed

- Package smoke test now expects the `dashboard` discovery link and exercises the Koa and `node:http` adapter exports.

## 3.3.0 - 2026-06-21

### Added

- Framework-agnostic adapters for Koa (`actuatorKoa`) and the built-in `node:http` module (`actuatorHttp`).
- Self-contained HTML dashboard served at `<basePath>/dashboard`, enabled by default.

## 3.2.1 - 2026-05-02

### Fixed

- Fastify plugin now mounts every registered custom endpoint (including those registered globally via `registerEndpoint(...)` by ecosystem packages such as `node-eventloop-watchdog`) as a Fastify route under `${basePath}/${id}`. Previously, only the built-in routes (`/health`, `/info`, `/metrics`, `/env`, `/threaddump`, `/heapdump`, `/prometheus`) were registered, so ecosystem-extension endpoints (e.g. `/actuator/eventloop`) were unreachable through the Fastify plugin even though discovery and `invokeEndpoint` knew about them.
- The `contentType: 'text'` flag is honoured in the Fastify plugin and emits `text/plain; charset=utf-8`, matching the Express middleware behaviour.

## 3.2.0 - 2026-05-02

### Added

- `/actuator/info` and `/actuator/metrics` endpoints with programmatic equivalents (`getInfo`, `getInfoAsync`, `getMetrics`).
- Custom endpoint registration via `endpoints` option, instance `registerEndpoint`, and package-level `registerEndpoint` for ecosystem integrations.
- Express and Fastify middleware now serve info, metrics, and registered custom endpoints.

## 3.1.1 - 2026-04-27

### Added

- Production-safety guidance for sensitive actuator endpoints.
- Package smoke test coverage for root and middleware subpath imports.
- Express and Fastify adapter tests for disabled feature flags.
- Security and contribution documentation.
- Runnable examples for Express, Fastify, AWS Lambda, and Kubernetes.

### Changed

- Express and Fastify adapters now honor disabled feature flags consistently with standalone mode.
- Package metadata now declares public export paths for root and middleware modules.
- README no longer references a missing demo GIF.

## 3.1.0 - 2026-03-06

### Added

- Spring Boot-style actuator endpoints for health, environment, thread dump, heap dump, Prometheus, and discovery.
- Standalone HTTP server, serverless APIs, Express middleware, and Fastify plugin.
- TypeScript declarations and CI coverage across supported Node.js versions.

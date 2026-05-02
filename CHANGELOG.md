# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses semantic versioning.

## Unreleased

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

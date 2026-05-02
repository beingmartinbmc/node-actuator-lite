# Examples

These examples show safe defaults for common deployment targets. Sensitive endpoints are disabled unless the example demonstrates how to protect them.

## Express

```bash
cd examples/express
npm install
ACTUATOR_TOKEN=dev-token npm start
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator/health
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator/prometheus
```

## Fastify

```bash
cd examples/fastify
npm install
ACTUATOR_TOKEN=dev-token npm start
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator/health
```

## AWS Lambda

`lambda/handler.cjs` exports an API Gateway-compatible handler using serverless mode.

## Kubernetes

`kubernetes/deployment.yaml` shows liveness and readiness probes against a dedicated actuator port.

## Ecosystem

`ecosystem/` shows `node-actuator-lite` wired together with `node-eventloop-watchdog` and `node-request-trace` to provide health, metrics, request timelines, and event-loop protection from a single Express app.

```bash
cd examples/ecosystem
npm install
ACTUATOR_TOKEN=dev-token npm start
curl -H "Authorization: Bearer dev-token" http://localhost:3000/actuator
open http://localhost:3000/trace/ui
```

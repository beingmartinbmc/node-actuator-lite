const express = require('express');
const { actuatorMiddleware } = require('node-actuator-lite');

const app = express();
const port = Number(process.env.PORT || 3000);
const actuatorToken = process.env.ACTUATOR_TOKEN;

function protectActuator(req, res, next) {
  if (!req.path.startsWith('/actuator')) return next();

  if (!actuatorToken) {
    return res.status(503).json({ error: 'ACTUATOR_TOKEN is required for actuator routes' });
  }

  const expected = `Bearer ${actuatorToken}`;
  if (req.get('authorization') !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

const { handler, actuator } = actuatorMiddleware({
  health: {
    showDetails: 'never',
    groups: {
      liveness: ['process'],
      readiness: ['diskSpace'],
    },
  },
  env: { enabled: false },
  threadDump: { enabled: false },
  heapDump: { enabled: false },
  prometheus: { defaultMetrics: true },
});

app.get('/', (_req, res) => {
  res.json({ service: 'express-example', status: 'ok' });
});

app.use(protectActuator);
app.use(handler);

app.get('/work', (_req, res) => {
  const counter = actuator.prometheus.metric('example_requests_total');
  counter?.inc({ route: '/work' });
  res.json({ ok: true });
});

actuator.prometheus.registerMetric({
  name: 'example_requests_total',
  help: 'Example request count',
  type: 'counter',
  labels: ['route'],
});

app.listen(port, () => {
  console.log(`Express example listening on http://localhost:${port}`);
});

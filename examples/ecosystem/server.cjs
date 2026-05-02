'use strict';

const express = require('express');
const { actuatorMiddleware } = require('node-actuator-lite');
const watchdog = require('node-eventloop-watchdog');
const trace = require('node-request-trace');

const port = Number(process.env.PORT || 3000);
const actuatorToken = process.env.ACTUATOR_TOKEN;

// 1. Initialise request tracing first so trace context is available everywhere.
trace.init({
  slowThreshold: 200,
  samplingRate: 1,
  traceOutgoing: true,
});

// 2. Start the event-loop watchdog in observe mode. It auto-registers
//    /actuator/eventloop endpoints when node-actuator-lite is installed and
//    attaches request context (from node-request-trace) to block events.
watchdog.start({
  warningThreshold: 100,
  criticalThreshold: 500,
  logLevel: 'warn',
});

// 3. Configure the actuator middleware. We add a custom "eventLoop" health
//    indicator backed by watchdog stats, and an info contributor showing
//    which ecosystem packages are wired up.
const { handler, actuator } = actuatorMiddleware({
  health: {
    showDetails: 'always',
    custom: [
      {
        name: 'eventLoop',
        critical: true,
        check: async () => {
          const stats = watchdog.getStats();
          const avgLag = stats.avgLag ?? 0;
          const maxLag = stats.maxLag ?? 0;
          const blocksLastMinute = stats.blocksLastMinute ?? 0;
          const status = blocksLastMinute > 5 || maxLag > 1000 ? 'DOWN' : 'UP';
          return {
            status,
            details: { avgLag, maxLag, blocksLastMinute },
          };
        },
      },
    ],
    groups: {
      liveness: ['process', 'eventLoop'],
      readiness: ['diskSpace', 'eventLoop'],
    },
  },
  info: {
    contributors: [
      {
        name: 'ecosystem',
        collect: () => ({
          actuator: require('node-actuator-lite/package.json').version,
          watchdog: require('node-eventloop-watchdog/package.json').version,
          trace: require('node-request-trace/package.json').version,
        }),
      },
    ],
  },
  env: { enabled: false },
  threadDump: { enabled: false },
  heapDump: { enabled: false },
  prometheus: { defaultMetrics: true },
});

// 4. Register a custom actuator endpoint that surfaces request trace stats.
actuator.registerEndpoint({
  id: 'traces/stats',
  handler: () => {
    const traces = trace.storage ? trace.storage.getAll() : [];
    const total = traces.length;
    if (total === 0) {
      return { totalRequests: 0, slowRequests: 0, avgLatency: 0 };
    }
    let sum = 0;
    let slow = 0;
    for (const t of traces) {
      sum += t.duration;
      if (t._slow) slow += 1;
    }
    return {
      totalRequests: total,
      slowRequests: slow,
      avgLatency: Math.round(sum / total),
    };
  },
});

const app = express();

// 5. Trace middleware first so every request, including /actuator/*, gets a
//    request id and timeline.
app.use(trace.middleware());

// 6. Optional bearer-token auth in front of actuator and trace UI.
function protectOps(req, res, next) {
  if (!req.path.startsWith('/actuator') && !req.path.startsWith('/trace')) {
    return next();
  }
  if (!actuatorToken) {
    return res.status(503).json({ error: 'ACTUATOR_TOKEN is required for ops routes' });
  }
  const expected = `Bearer ${actuatorToken}`;
  if (req.get('authorization') !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

app.use(protectOps);
app.use(handler);
app.use(trace.routes());

// 7. Demo workload routes.
app.get('/', (_req, res) => {
  res.json({ service: 'ecosystem-example', status: 'ok' });
});

app.get('/work', async (_req, res) => {
  await trace.step('cpu.work', async () => {
    const start = Date.now();
    while (Date.now() - start < 50) {
      // Simulate small CPU work that should not trip the watchdog.
    }
  });
  res.json({ ok: true });
});

app.get('/slow', async (_req, res) => {
  await trace.step('io.slow', () => new Promise((r) => setTimeout(r, 250)));
  res.json({ ok: true, slow: true });
});

app.get('/stall', (_req, res) => {
  // Intentionally block the event loop to demonstrate the watchdog.
  const start = Date.now();
  while (Date.now() - start < 200) {
    // Spin to block the loop.
  }
  res.json({ ok: true, stalled: true });
});

const server = app.listen(port, () => {
  console.log(`Ecosystem example listening on http://localhost:${port}`);
  console.log('  Actuator:   /actuator');
  console.log('  Trace UI:   /trace/ui');
  console.log('  Demo:       /work, /slow, /stall');
});

function shutdown() {
  watchdog.stop();
  trace.destroy();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

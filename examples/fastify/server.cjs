const Fastify = require('fastify');
const { actuatorPlugin } = require('node-actuator-lite');

const app = Fastify({ logger: true });
const port = Number(process.env.PORT || 3000);
const actuatorToken = process.env.ACTUATOR_TOKEN;

app.addHook('preHandler', async (request, reply) => {
  if (!request.url.startsWith('/actuator')) return;

  if (!actuatorToken) {
    reply.code(503).send({ error: 'ACTUATOR_TOKEN is required for actuator routes' });
    return;
  }

  const expected = `Bearer ${actuatorToken}`;
  if (request.headers.authorization !== expected) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

app.get('/', async () => ({ service: 'fastify-example', status: 'ok' }));

app.register(actuatorPlugin, {
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

app.listen({ port, host: '0.0.0.0' }).then(() => {
  app.log.info(`Fastify example listening on http://localhost:${port}`);
});

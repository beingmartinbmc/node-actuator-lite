const { NodeActuator } = require('node-actuator-lite');

const actuator = new NodeActuator({
  serverless: true,
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

function response(statusCode, body, contentType = 'application/json') {
  return {
    statusCode,
    headers: { 'Content-Type': contentType },
    body: contentType === 'application/json' ? JSON.stringify(body) : body,
  };
}

exports.handler = async function handler(event) {
  const rawPath = event.rawPath || event.path || '/actuator';
  const path = rawPath.replace(/^\/actuator\/?/, '');

  if (path === '') return response(200, actuator.discovery());

  if (path === 'health') {
    const health = await actuator.getHealth(event.queryStringParameters?.showDetails);
    return response(health.status === 'UP' ? 200 : 503, health);
  }

  if (path.startsWith('health/')) {
    const name = decodeURIComponent(path.slice('health/'.length));
    const group = await actuator.getHealthGroup(name);
    if (group) return response(group.status === 'UP' ? 200 : 503, group);

    const component = await actuator.getHealthComponent(name);
    if (component) return response(component.status === 'UP' ? 200 : 503, component);

    return response(404, { error: 'Not found' });
  }

  if (path === 'prometheus') {
    return response(200, await actuator.getPrometheus(), 'text/plain; charset=utf-8');
  }

  return response(404, { error: 'Not found' });
};

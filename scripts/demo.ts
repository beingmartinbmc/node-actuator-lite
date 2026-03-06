/**
 * Demo script — start the actuator and curl all endpoints.
 *
 * Usage:
 *   npx ts-node scripts/demo.ts
 *
 * Record as GIF (requires https://github.com/faressoft/terminalizer):
 *   terminalizer record demo -c scripts/terminalizer.yml
 *   terminalizer render demo -o assets/demo.gif
 */

import { NodeActuator } from '../src';

async function main() {
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
    prometheus: { defaultMetrics: true },
  });

  await actuator.start();
  console.log('\n--- node-actuator-lite demo ---\n');

  const endpoints = [
    { label: 'Discovery', url: 'http://localhost:8081/actuator' },
    { label: 'Health (deep)', url: 'http://localhost:8081/actuator/health' },
    { label: 'Health (shallow)', url: 'http://localhost:8081/actuator/health?showDetails=never' },
    { label: 'Liveness group', url: 'http://localhost:8081/actuator/health/liveness' },
    { label: 'Environment', url: 'http://localhost:8081/actuator/env' },
    { label: 'Single env var', url: 'http://localhost:8081/actuator/env/NODE_ENV' },
    { label: 'Prometheus', url: 'http://localhost:8081/actuator/prometheus' },
  ];

  for (const ep of endpoints) {
    console.log(`\x1b[36m$ curl ${ep.url}\x1b[0m`);
    const res = await fetch(ep.url);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('json')) {
      const json = await res.json();
      console.log(JSON.stringify(json, null, 2).slice(0, 500));
    } else {
      const text = await res.text();
      // Show first 8 lines of prometheus output
      console.log(text.split('\n').slice(0, 8).join('\n') + '\n...');
    }
    console.log();
  }

  await actuator.stop();
  process.exit(0);
}

main().catch(console.error);

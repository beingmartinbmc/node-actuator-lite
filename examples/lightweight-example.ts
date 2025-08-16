import { LightweightActuator } from '../src/core/LightweightActuator';

// Simple example using the lightweight (Express-free) actuator
async function main() {
  // Create lightweight actuator
  const actuator = new LightweightActuator({
    port: 3001,
    basePath: '/actuator',
    enableHealth: true,
    enableMetrics: true,
    enablePrometheus: true,
    enableInfo: true,
    enableEnv: true,
    customHealthChecks: [
      // Custom health check
      async () => {
        return {
          status: 'UP',
          details: { message: 'Custom health check passed' }
        };
      }
    ],
    customMetrics: [
      { name: 'custom_counter', help: 'A custom counter', type: 'counter' },
      { name: 'custom_gauge', help: 'A custom gauge', type: 'gauge' }
    ]
  });

  try {
    // Start the actuator
    const port = await actuator.start();
    console.log(`🚀 Lightweight Actuator running on port ${port}`);
    console.log(`📊 Health: http://localhost:${port}/actuator/health`);
    console.log(`📈 Metrics: http://localhost:${port}/actuator/metrics`);
    console.log(`📊 Prometheus: http://localhost:${port}/actuator/prometheus`);
    console.log(`ℹ️  Info: http://localhost:${port}/actuator/info`);
    console.log(`🌍 Environment: http://localhost:${port}/actuator/env`);

    // Get custom metrics
    const counter = actuator.getCustomMetric('custom_counter');
    const gauge = actuator.getCustomMetric('custom_gauge');

    // Update metrics periodically
    setInterval(() => {
      counter.inc();
      gauge.set(Math.random() * 100);
    }, 5000);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      await actuator.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down...');
      await actuator.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start actuator:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main();
}

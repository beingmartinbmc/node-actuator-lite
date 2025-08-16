import { LightweightActuator } from '../src/core/LightweightActuator';

async function main() {
  console.log('🚀 Starting Lightweight Actuator with enhanced thread dump and heap dump...');

  const actuator = new LightweightActuator({
    port: 3001,
    basePath: '/actuator',
    enableHealth: true,
    enableMetrics: true,
    enableInfo: true,
    enableEnv: true,
    enablePrometheus: true,
    enableThreadDump: true,
    enableHeapDump: true,
    heapDumpOptions: {
      outputDir: './heapdumps',
      includeTimestamp: true,
      compress: false
    }
  });

  try {
    const port = await actuator.start();
    console.log(`✅ Lightweight Actuator started successfully on port ${port}`);
    console.log(`📊 Health: http://localhost:${port}/actuator/health`);
    console.log(`📈 Metrics: http://localhost:${port}/actuator/metrics`);
    console.log(`ℹ️  Info: http://localhost:${port}/actuator/info`);
    console.log(`🧵 Thread Dump: http://localhost:${port}/actuator/threaddump`);
    console.log(`💾 Heap Dump: http://localhost:${port}/actuator/heapdump`);
    console.log(`📊 Prometheus: http://localhost:${port}/actuator/prometheus`);
    console.log(`🌍 Environment: http://localhost:${port}/actuator/env`);
    
    console.log('\n💡 Try these commands in another terminal:');
    console.log(`   curl http://localhost:${port}/actuator/health`);
    console.log(`   curl http://localhost:${port}/actuator/threaddump`);
    console.log(`   curl http://localhost:${port}/actuator/heapdump`);
    console.log(`   curl http://localhost:${port}/actuator/prometheus`);

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
    console.error('❌ Failed to start Lightweight Actuator:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

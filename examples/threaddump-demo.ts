import { Actuator } from '../src/core/Actuator';

async function demonstrateThreadDump() {
  console.log('🚀 Starting Node Actuator Lite with comprehensive thread dump...\n');

  // Create actuator with thread dump enabled
  const actuator = new Actuator({
    port: 3001,
    basePath: '/actuator',
    enableThreadDump: true,
    enableHealth: true,
    enableMetrics: true,
    enablePrometheus: true,
    enableInfo: true,
    enableEnv: true,
    enableMappings: true,
    enableBeans: true,
    enableConfigProps: true,
    enableHeapDump: true
  });

  // Start the actuator
  await actuator.start();
  console.log(`✅ Actuator started on port ${actuator.getPort()}`);
  console.log(`📊 Thread dump available at: http://localhost:${actuator.getPort()}/actuator/threaddump\n`);

  // Simulate some async operations to make the thread dump more interesting
  console.log('🔄 Creating some async operations to demonstrate thread tracking...');
  
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(
      new Promise(resolve => {
        setTimeout(() => {
          console.log(`✅ Async operation ${i + 1} completed`);
          resolve(i);
        }, Math.random() * 1000 + 500);
      })
    );
  }

  // Wait for some operations to complete
  await Promise.all(promises.slice(0, 5));
  console.log('✅ Some async operations completed\n');

  // Demonstrate the thread dump endpoint
  console.log('📋 Thread Dump Information:');
  console.log('============================');
  console.log('The /actuator/threaddump endpoint now provides:');
  console.log('• Main thread information with detailed stack trace');
  console.log('• CPU usage statistics (user time, system time)');
  console.log('• Thread state (RUNNABLE, WAITING, etc.)');
  console.log('• Event loop phase information');
  console.log('• Active and pending requests/handles');
  console.log('• Async operations tracking');
  console.log('• Worker threads (if any)');
  console.log('• Summary statistics');
  console.log('\n🌐 Try accessing: http://localhost:3001/actuator/threaddump');
  console.log('📊 Compare this with the old minimal implementation!');

  // Keep the server running for demonstration
  console.log('\n⏳ Server will run for 30 seconds for demonstration...');
  console.log('Press Ctrl+C to stop early\n');

  setTimeout(async () => {
    console.log('\n🛑 Shutting down...');
    await actuator.shutdown();
    console.log('✅ Shutdown complete');
    process.exit(0);
  }, 30000);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await actuator.shutdown();
    console.log('✅ Shutdown complete');
    process.exit(0);
  });
}

// Run the demonstration
demonstrateThreadDump().catch(error => {
  console.error('❌ Error running demonstration:', error);
  process.exit(1);
}); 
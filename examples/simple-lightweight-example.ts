import { LightweightServer } from '../src/core/LightweightServer';

// Simple example showing the lightweight server works
async function main() {
  console.log('🚀 Starting simple lightweight server example...');

  // Create lightweight server
  const server = new LightweightServer(3001, '/api');

  // Add some simple routes
  server.get('/health', async (_req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      message: 'Server is healthy!'
    });
  });

  server.get('/info', async (_req, res) => {
    res.status(200).json({
      name: 'Simple Lightweight Server',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  server.get('/metrics', async (_req, res) => {
    const os = require('os');
    res.status(200).json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: os.cpus().length,
      platform: os.platform()
    });
  });

  try {
    // Start the server
    const port = await server.start();
    console.log(`✅ Server started successfully on port ${port}`);
    console.log(`📊 Health: http://localhost:${port}/api/health`);
    console.log(`ℹ️  Info: http://localhost:${port}/api/info`);
    console.log(`📈 Metrics: http://localhost:${port}/api/metrics`);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main();
}

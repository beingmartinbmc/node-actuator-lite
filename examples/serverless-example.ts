import { LightweightActuator, LightweightActuatorOptions } from '../src/core/LightweightActuator';

// Example serverless application
async function main() {
  console.log('🚀 Starting Serverless Lightweight Actuator Example...');

  // Configure actuator options for serverless environment
  const actuatorOptions: LightweightActuatorOptions = {
    serverless: true, // Enable serverless mode
    basePath: '/actuator',
    enableHealth: true,
    enableMetrics: true,
    enableInfo: true,
    enableEnv: true,
    enablePrometheus: true,
    enableMappings: true,
    enableBeans: true,
    enableConfigProps: true,
    enableThreadDump: true,
    enableHeapDump: true,
    heapDumpOptions: {
      outputDir: './heapdumps',
      includeTimestamp: true,
      compress: false
    },
    healthOptions: {
      includeDiskSpace: true,
      includeProcess: true,
      diskSpaceThreshold: 10 * 1024 * 1024 * 1024, // 10GB
      healthCheckTimeout: 5000
    },
    // Named custom health checks
    customHealthChecks: [
      {
        name: 'database',
        check: async () => {
          // Simulate database health check
          const isHealthy = Math.random() > 0.1; // 90% success rate
          return {
            status: isHealthy ? 'UP' : 'DOWN',
            details: {
              connection: isHealthy ? 'established' : 'failed',
              responseTime: Math.random() * 100
            }
          };
        }
      },
      {
        name: 'external-api',
        check: async () => {
          // Simulate external API health check
          const isHealthy = Math.random() > 0.05; // 95% success rate
          return {
            status: isHealthy ? 'UP' : 'DOWN',
            details: {
              endpoint: 'https://api.example.com/health',
              responseTime: Math.random() * 200
            }
          };
        }
      }
    ],
    // Custom metrics
    customMetrics: [
      {
        name: 'serverless_requests_total',
        help: 'Total number of serverless function requests',
        type: 'counter'
      },
      {
        name: 'serverless_execution_time_seconds',
        help: 'Serverless function execution time in seconds',
        type: 'histogram'
      },
      {
        name: 'serverless_memory_usage_bytes',
        help: 'Serverless function memory usage in bytes',
        type: 'gauge'
      }
    ],
    // Custom beans
    customBeans: {
      serverlessFunction: {
        type: 'ServerlessFunction',
        scope: 'singleton',
        description: 'Serverless function instance'
      },
      dataProcessor: {
        type: 'DataProcessor',
        scope: 'singleton',
        description: 'Data processing service'
      }
    },
    // Custom configuration properties
    customConfigProps: {
      'serverless.function.name': {
        value: 'my-actuator-function',
        origin: 'environment'
      },
      'serverless.function.version': {
        value: '1.0.0',
        origin: 'package.json'
      },
      'serverless.region': {
        value: 'us-east-1',
        origin: 'environment'
      }
    }
  };

  // Create actuator instance
  const actuator = new LightweightActuator(actuatorOptions);

  try {
    // Initialize the actuator (no server started in serverless mode)
    await actuator.start();
    
    console.log('✅ Serverless Actuator initialized successfully');
    console.log('');
    console.log('🔧 Available direct data access methods:');
    console.log('  await actuator.getHealth() - Health check data');
    console.log('  await actuator.getMetrics() - Application metrics');
    console.log('  await actuator.getPrometheusMetrics() - Prometheus format');
    console.log('  await actuator.getInfo() - Application info');
    console.log('  await actuator.getEnvironment() - Environment variables');
    console.log('  actuator.getConfigProps() - Configuration properties');
    console.log('  actuator.getBeans() - Application beans');
    console.log('  actuator.getMappings() - Route mappings');
    console.log('  actuator.getThreadDump() - Thread dump');
    console.log('  await actuator.getHeapDump() - Heap dump');
    console.log('');
    console.log('💡 Example usage in serverless function:');
    console.log('');
    console.log('// Vercel API Route Example:');
    console.log('export default async function handler(req, res) {');
    console.log('  const { path } = req.query;');
    console.log('  ');
    console.log('  switch (path) {');
    console.log('    case "health":');
    console.log('      const health = await actuator.getHealth();');
    console.log('      res.json(health);');
    console.log('      break;');
    console.log('    case "metrics":');
    console.log('      const metrics = await actuator.getMetrics();');
    console.log('      res.json(metrics);');
    console.log('      break;');
    console.log('    case "prometheus":');
    console.log('      const prometheus = await actuator.getPrometheusMetrics();');
    console.log('      res.setHeader("Content-Type", "text/plain");');
    console.log('      res.send(prometheus);');
    console.log('      break;');
    console.log('    default:');
    console.log('      res.status(404).json({ error: "Endpoint not found" });');
    console.log('  }');
    console.log('}');
    console.log('');
    console.log('📊 Custom metrics will be available in Prometheus format');
    console.log('🏥 Custom health checks include database and external API');
    console.log('⚙️  Custom beans and config props are exposed');
    console.log('🚀 Perfect for Vercel, Netlify, AWS Lambda, and other serverless platforms');

    // Demonstrate direct data access
    console.log('');
    console.log('🧪 Testing direct data access methods...');
    
    try {
      const health = await actuator.getHealth();
      console.log('✅ Health check:', health.status);
      
      const metrics = await actuator.getMetrics();
      console.log('✅ Metrics collected:', Object.keys(metrics).length, 'categories');
      
      const info = await actuator.getInfo();
      console.log('✅ Info collected:', info.name);
      
      const prometheus = await actuator.getPrometheusMetrics();
      console.log('✅ Prometheus metrics:', prometheus.split('\n').length, 'lines');
      
      const threadDump = actuator.getThreadDump();
      console.log('✅ Thread dump generated:', threadDump.pid ? 'success' : 'failed');
      
    } catch (error) {
      console.error('❌ Error testing data access:', error);
    }

    // Simulate some application activity
    const customMetric = actuator.getCustomMetric('serverless_requests_total');
    if (customMetric) {
      setInterval(() => {
        customMetric.inc();
        console.log('📈 Incremented serverless_requests_total metric');
      }, 10000);
    }

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
    console.error('❌ Failed to initialize Serverless Actuator:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

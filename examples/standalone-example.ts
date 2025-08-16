import { LightweightActuator, LightweightActuatorOptions } from '../src/core/LightweightActuator';

// Example standalone server application
async function main() {
  console.log('🚀 Starting Standalone Lightweight Actuator Example...');

  // Configure actuator options for standalone server
  const actuatorOptions: LightweightActuatorOptions = {
    port: 3001, // Fixed port for standalone server
    serverless: false, // Explicitly set to false for standalone
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
        name: 'app_requests_total',
        help: 'Total number of application requests',
        type: 'counter'
      },
      {
        name: 'app_response_time_seconds',
        help: 'Application response time in seconds',
        type: 'histogram'
      },
      {
        name: 'app_active_users',
        help: 'Number of active users',
        type: 'gauge'
      }
    ],
    // Custom beans
    customBeans: {
      userService: {
        type: 'UserService',
        scope: 'singleton',
        description: 'Service for user management'
      },
      emailService: {
        type: 'EmailService',
        scope: 'singleton',
        description: 'Service for email operations'
      }
    },
    // Custom configuration properties
    customConfigProps: {
      'app.name': {
        value: 'My Application',
        origin: 'application.yml'
      },
      'app.version': {
        value: '1.0.0',
        origin: 'package.json'
      },
      'database.url': {
        value: 'mongodb://localhost:27017/myapp',
        origin: 'environment'
      }
    }
  };

  // Create actuator instance
  const actuator = new LightweightActuator(actuatorOptions);

  try {
    // Start the actuator server
    const port = await actuator.start();
    
    console.log(`✅ Standalone Actuator started successfully on port ${port}`);
    console.log('');
    console.log('🔧 Available endpoints:');
    console.log(`  GET  http://localhost:${port}/actuator/health - Health check`);
    console.log(`  GET  http://localhost:${port}/actuator/metrics - Application metrics`);
    console.log(`  GET  http://localhost:${port}/actuator/prometheus - Prometheus metrics`);
    console.log(`  GET  http://localhost:${port}/actuator/info - Application info`);
    console.log(`  GET  http://localhost:${port}/actuator/env - Environment variables`);
    console.log(`  GET  http://localhost:${port}/actuator/configprops - Configuration properties`);
    console.log(`  GET  http://localhost:${port}/actuator/beans - Application beans`);
    console.log(`  GET  http://localhost:${port}/actuator/mappings - Route mappings`);
    console.log(`  GET  http://localhost:${port}/actuator/threaddump - Thread dump`);
    console.log(`  GET  http://localhost:${port}/actuator/heapdump - Heap dump`);
    console.log('');
    console.log('💡 Try these commands:');
    console.log(`   curl http://localhost:${port}/actuator/health`);
    console.log(`   curl http://localhost:${port}/actuator/metrics`);
    console.log(`   curl http://localhost:${port}/actuator/prometheus`);
    console.log(`   curl http://localhost:${port}/actuator/threaddump`);
    console.log(`   curl http://localhost:${port}/actuator/mappings`);
    console.log('');
    console.log('📊 Custom metrics will be available in Prometheus format');
    console.log('🏥 Custom health checks include database and external API');
    console.log('⚙️  Custom beans and config props are exposed');

    // Simulate some application activity
    const customMetric = actuator.getCustomMetric('app_requests_total');
    if (customMetric) {
      setInterval(() => {
        customMetric.inc();
        console.log('📈 Incremented app_requests_total metric');
      }, 5000);
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
    console.error('❌ Failed to start Standalone Actuator:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

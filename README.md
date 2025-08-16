# Node Actuator Lite

A lightweight Node.js actuator similar to Spring Boot actuator with Prometheus integration, built with minimal external dependencies for maximum performance and minimal footprint. Perfect for **serverless platforms** like Vercel, AWS Lambda, and microservices.

## 🚀 Key Features

- **Minimal Dependencies**: Only essential dependencies (prom-client, uuid)
- **Dual Mode Support**: Standalone HTTP server and serverless mode
- **Serverless Ready**: Optimized for Vercel, AWS Lambda, and other serverless platforms
- **Health Monitoring**: Real-time health checks with named custom indicators
- **Metrics Collection**: System and process metrics with Prometheus integration
- **Thread Dump**: Detailed Node.js event loop analysis with async operations
- **Heap Dump**: V8 heap snapshots and comprehensive memory analysis
- **Lightweight**: Perfect for serverless and microservices
- **Fast Startup**: Minimal initialization overhead
- **Small Bundle Size**: Ideal for resource-constrained environments
- **Framework Agnostic**: Works with any Node.js application

## 📊 Mode Comparison

| Feature | Standalone Mode | Serverless Mode |
|---------|----------------|-----------------|
| **HTTP Server** | ✅ Starts own server | ❌ No server |
| **Port Required** | ✅ Yes | ❌ No |
| **Data Access** | HTTP endpoints | Direct methods |
| **Use Case** | Traditional apps | Serverless functions |
| **Platforms** | Express, Fastify, etc. | Vercel, Lambda, Netlify |
| **Performance** | Good | Excellent (no server overhead) |
| **Setup** | Simple | Simple |

## 📦 Installation

```bash
npm install node-actuator-lite
```

### Dependencies

Node Actuator Lite uses minimal external dependencies:

- **prom-client** (^15.1.0) - For Prometheus metrics collection
- **uuid** (^9.0.1) - For generating unique identifiers

These dependencies are essential for the core functionality and are kept to a minimum to maintain the lightweight nature of the library.

## 🎯 Quick Start

### Standalone Mode (HTTP Server)

Perfect for traditional Node.js applications that can start their own HTTP server:

```typescript
import { LightweightActuator } from 'node-actuator-lite';

const actuator = new LightweightActuator({
  port: 3001,
  serverless: false,
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true,
  enableThreadDump: true,
  enableHeapDump: true
});

await actuator.start();
console.log(`Actuator running on port ${actuator.getPort()}`);
```

**Access via HTTP endpoints:**
- `GET http://localhost:3001/actuator/health`
- `GET http://localhost:3001/actuator/metrics`
- `GET http://localhost:3001/actuator/prometheus`

### Serverless Mode (Direct Data Access)

Perfect for serverless platforms like Vercel, AWS Lambda, Netlify:

```typescript
import { LightweightActuator } from 'node-actuator-lite';

const actuator = new LightweightActuator({
  serverless: true,
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true
});

// Initialize (no HTTP server started)
await actuator.start();

// Use direct data access methods
const health = await actuator.getHealth();
const metrics = await actuator.getMetrics();
const prometheus = await actuator.getPrometheusMetrics();
```

**Access via direct method calls** - no HTTP server needed!

## 🔧 Configuration

### LightweightActuatorOptions

```typescript
interface LightweightActuatorOptions {
  port?: number;                    // Server port (0 for dynamic, ignored in serverless mode)
  serverless?: boolean;             // Enable serverless mode (default: false)
  basePath?: string;                // Base path for endpoints (default: '/actuator')
  enableHealth?: boolean;           // Enable health checks (default: true)
  enableMetrics?: boolean;          // Enable system metrics (default: true)
  enableInfo?: boolean;             // Enable server info (default: true)
  enableEnv?: boolean;              // Enable environment info (default: true)
  enablePrometheus?: boolean;       // Enable Prometheus metrics (default: true)

  enableThreadDump?: boolean;       // Enable thread dump (default: true)
  enableHeapDump?: boolean;         // Enable heap dump (default: true)
  heapDumpOptions?: {               // Heap dump configuration
    outputDir?: string;             // Output directory (default: './heapdumps')
    filename?: string;              // Custom filename
    includeTimestamp?: boolean;     // Include timestamp in filename (default: true)
    compress?: boolean;             // Compress heap dump (default: false)
    maxDepth?: number;              // Maximum depth for analysis
  };
  customHealthChecks?: Array<       // Custom health checks
    (() => Promise<{ status: string; details?: any }>) | {
      name: string;
      check: () => Promise<{ status: string; details?: any }>;
    }
  >;
  customMetrics?: Array<{           // Custom Prometheus metrics
    name: string;
    help: string;
    type: 'counter' | 'gauge' | 'histogram';
  }>;

  healthOptions?: {                 // Health check configuration
    includeDiskSpace?: boolean;     // Include disk space check (default: true)
    includeProcess?: boolean;       // Include process check (default: true)
    diskSpaceThreshold?: number;    // Minimum free disk space in bytes
    diskSpacePath?: string;         // Path to check disk space for
    healthCheckTimeout?: number;    // Timeout for health checks in milliseconds
    customIndicators?: Array<{      // Custom health indicators
      name: string;
      check: () => Promise<{ status: string; details?: any }>;
      enabled?: boolean;
      critical?: boolean;
    }>;
  };
  retryOptions?: {                  // Retry configuration
    maxRetries?: number;            // Maximum retry attempts (default: 3)
    retryDelay?: number;            // Base delay between retries (default: 100ms)
    exponentialBackoff?: boolean;   // Use exponential backoff (default: true)
  };
}
```

## 🌐 Available Endpoints

### Standalone Mode Endpoints

When running in standalone mode, the following HTTP endpoints are available:

- **Health Check**: `GET /actuator/health`
- **System Metrics**: `GET /actuator/metrics`
- **Prometheus Metrics**: `GET /actuator/prometheus`
- **Server Info**: `GET /actuator/info`
- **Environment**: `GET /actuator/env`
- **Thread Dump**: `GET /actuator/threaddump`
- **Heap Dump**: `GET /actuator/heapdump`


### Serverless Mode Methods

When running in serverless mode, use these direct data access methods:

```typescript
// Health and monitoring
await actuator.getHealth()                    // Health check data
await actuator.getMetrics()                   // Application metrics
await actuator.getPrometheusMetrics()         // Prometheus format
await actuator.getInfo()                      // Application info
await actuator.getEnvironment()               // Environment variables

// Diagnostics
actuator.getThreadDump()                      // Thread dump (synchronous)
await actuator.getHeapDump()                  // Heap dump (asynchronous)

// Custom metrics
actuator.getCustomMetric('metric_name')       // Get custom metric instance
```

## 🚀 Serverless Integration

### Auto-Detection

The library automatically detects serverless environments and warns if `serverless: true` is not set:

```typescript
// Auto-detected environments:
// - Vercel (VERCEL_ENV)
// - Netlify (NETLIFY)
// - AWS Lambda (AWS_LAMBDA_FUNCTION_NAME)

const actuator = new LightweightActuator({
  serverless: true, // Recommended for serverless
  // ... other options
});
```

### Important Notes

⚠️ **Methods Not Available**: The following methods mentioned in some examples are **not implemented** in the current version:
- `getBeans()`
- `getConfigProps()`
- `getMappings()`

These are placeholders for future implementation. Use only the methods listed in the "Serverless Mode Methods" section above.

### Vercel Integration Example

```typescript
// api/actuator/[...path].ts
import { LightweightActuator } from 'node-actuator-lite';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const actuator = new LightweightActuator({
  serverless: true,
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true,
  enableInfo: true,
  enableEnv: true,
  enableThreadDump: true,
  enableHeapDump: true,
  customHealthChecks: [
    {
      name: 'database',
      check: async () => {
        // Your database health check logic
        return { status: 'UP', details: { connection: 'ok' } };
      }
    }
  ]
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { path } = req.query;
  const pathString = Array.isArray(path) ? path.join('/') : path || '';
  
  try {
    switch (pathString) {
      case 'health':
        const health = await actuator.getHealth();
        res.json(health);
        break;
      case 'metrics':
        const metrics = await actuator.getMetrics();
        res.json(metrics);
        break;
      case 'prometheus':
        const prometheus = await actuator.getPrometheusMetrics();
        res.setHeader('Content-Type', 'text/plain');
        res.send(prometheus);
        break;
      case 'info':
        const info = await actuator.getInfo();
        res.json(info);
        break;
      case 'env':
        const env = await actuator.getEnvironment();
        res.json(env);
        break;
      case 'threaddump':
        const threadDump = actuator.getThreadDump();
        res.json(threadDump);
        break;
      case 'heapdump':
        const heapDump = await actuator.getHeapDump();
        res.json(heapDump);
        break;
      default:
        res.status(404).json({ 
          error: 'Endpoint not found',
          availableEndpoints: ['health', 'metrics', 'prometheus', 'info', 'env', 'threaddump', 'heapdump']
        });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### AWS Lambda Integration Example

```typescript
// lambda-actuator.ts
import { LightweightActuator } from 'node-actuator-lite';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const actuator = new LightweightActuator({
  serverless: true,
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.pathParameters?.path || '';
  
  try {
    switch (path) {
      case 'health':
        const health = await actuator.getHealth();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(health)
        };
      case 'prometheus':
        const prometheus = await actuator.getPrometheusMetrics();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/plain' },
          body: prometheus
        };
      default:
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Endpoint not found' })
        };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
```

## 🏥 Health Checks

### Built-in Health Checks

- **Disk Space**: Monitors available disk space
- **Process**: Basic process health information

### Custom Health Checks

Support both legacy function format and named format:

```typescript
// Legacy format
customHealthChecks: [
  async () => ({ status: 'UP', details: { connection: 'ok' } })
]

// Named format (recommended)
customHealthChecks: [
  {
    name: 'database',
    check: async () => {
      // Database health check logic
      return { status: 'UP', details: { connection: 'established' } };
    }
  },
  {
    name: 'external-api',
    check: async () => {
      // External API health check logic
      return { status: 'UP', details: { responseTime: 150 } };
    }
  }
]
```

## 📊 Metrics

### Built-in Metrics

- System metrics (CPU, memory, disk)
- Process metrics (uptime, memory usage)
- HTTP request metrics (when using HTTP endpoints)

### Custom Metrics

```typescript
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
]

// Usage
const requestCounter = actuator.getCustomMetric('app_requests_total');
requestCounter.inc();
```

## 🧵 Thread Dump

Provides detailed analysis of the Node.js event loop:

- Main thread information
- Event loop phases and statistics
- Async operations tracking
- Worker threads information
- Active handles and requests
- Memory and CPU information

## 💾 Heap Dump

Generates comprehensive memory analysis:

- V8 heap snapshots (Node.js 12+)
- Memory usage statistics
- Garbage collection information
- Loaded modules
- System information
- File-based output for analysis

## 🚨 Troubleshooting

### Common Issues

**1. "Cannot start server in serverless environment"**
```typescript
// ❌ Wrong - Don't do this in serverless
const actuator = new LightweightActuator({ port: 3001 });

// ✅ Correct - Use serverless mode
const actuator = new LightweightActuator({ serverless: true });
```

**2. "Method not found" errors**
```typescript
// ❌ These methods don't exist
actuator.getBeans();           // Not implemented
actuator.getConfigProps();     // Not implemented
actuator.getMappings();        // Not implemented

// ✅ Use these methods instead
await actuator.getHealth();
await actuator.getMetrics();
await actuator.getPrometheusMetrics();
actuator.getThreadDump();
await actuator.getHeapDump();
```

**3. Custom metric label errors**
```typescript
// ❌ Wrong - Labels must be defined when creating the metric
const counter = actuator.getCustomMetric('my_counter');
counter.inc({ label: 'value' }); // Error!

// ✅ Correct - Define labels in customMetrics configuration
const actuator = new LightweightActuator({
  customMetrics: [
    { name: 'my_counter', help: 'My counter', type: 'counter' }
  ]
});
const counter = actuator.getCustomMetric('my_counter');
counter.inc(); // Works!
```

## 📚 Examples

See the `examples/` directory for comprehensive usage examples:

- `standalone-example.ts` - Standalone HTTP server usage
- `serverless-example.ts` - Serverless mode usage

## 🔗 Usage Documentation

For detailed usage examples and integration patterns, see [USAGE.md](./USAGE.md).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Spring Boot Actuator
- Built with Prometheus client library
- Optimized for serverless environments

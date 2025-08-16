# Node Actuator Lite - Usage Guide

This guide shows you how to use Node Actuator Lite in your applications, with special focus on **serverless platforms** like Vercel, AWS Lambda, and traditional Node.js applications.

## Quick Start

### Basic Setup

```typescript
import { LightweightActuator } from 'node-actuator-lite';

const actuator = new LightweightActuator({
  port: 3001,
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true
});

await actuator.start();
```

### Serverless Setup (Vercel, AWS Lambda)

```typescript
import { LightweightActuator } from 'node-actuator-lite';

// For serverless, use dynamic port
const actuator = new LightweightActuator({
  port: 0,  // Dynamic port assignment
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true,
  enableInfo: true,
  enableEnv: true
});

// Initialize but don't start server (serverless platforms handle this)
await actuator.initialize();

export default actuator;
```

## 🌐 Serverless Integration

### Vercel Integration

Create a Vercel API route for actuator endpoints:

```typescript
// api/actuator/[...path].ts
import { LightweightActuator } from 'node-actuator-lite';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const actuator = new LightweightActuator({
  port: 0,
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true,
  enableInfo: true,
  enableEnv: true
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { path } = req.query;
  const pathString = Array.isArray(path) ? path.join('/') : path || '';
  
  try {
    // Route to appropriate actuator endpoint
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
      default:
        res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### AWS Lambda Integration

```typescript
// lambda-actuator.ts
import { LightweightActuator } from 'node-actuator-lite';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const actuator = new LightweightActuator({
  port: 0,
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true,
  enableInfo: true,
  enableEnv: true
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.pathParameters?.proxy || '';
  
  try {
    switch (path) {
      case 'health':
        const health = await actuator.getHealth();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(health)
        };
      case 'metrics':
        const metrics = await actuator.getMetrics();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metrics)
        };
      case 'prometheus':
        const prometheus = await actuator.getPrometheusMetrics();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/plain' },
          body: prometheus
        };
      case 'info':
        const info = await actuator.getInfo();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(info)
        };
      case 'env':
        const env = await actuator.getEnvironment();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(env)
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

### Built-in HTTP Server Integration

The library includes its own lightweight HTTP server implementation that you can use directly:

```typescript
import { LightweightServer } from 'node-actuator-lite';

const server = new LightweightServer(3001, '/api');

// Add your custom routes
server.get('/users', async (_req, res) => {
  res.status(200).json({ users: [] });
});

// Add actuator endpoints
server.get('/actuator/health', async (_req, res) => {
  try {
    const actuator = new LightweightActuator({ port: 0 });
    const health = await actuator.getHealth();
    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({ error: 'Health check failed' });
  }
});

server.get('/actuator/metrics', async (_req, res) => {
  try {
    const actuator = new LightweightActuator({ port: 0 });
    const metrics = await actuator.getMetrics();
    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Metrics collection failed' });
  }
});

server.get('/actuator/prometheus', async (_req, res) => {
  try {
    const actuator = new LightweightActuator({ port: 0 });
    const prometheus = await actuator.getPrometheusMetrics();
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(prometheus);
  } catch (error) {
    res.status(500).json({ error: 'Prometheus metrics failed' });
  }
});

// Start the server
await server.start();
console.log('Server running on port 3001');
console.log('Actuator endpoints available at /actuator/*');
```

### Vanilla Node.js HTTP Integration

You can also integrate with the built-in Node.js HTTP module:

```typescript
import { createServer } from 'http';
import { LightweightActuator } from 'node-actuator-lite';

const actuator = new LightweightActuator({ port: 0 });

const server = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    switch (path) {
      case '/actuator/health':
        const health = await actuator.getHealth();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health));
        break;
      
      case '/actuator/metrics':
        const metrics = await actuator.getMetrics();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metrics));
        break;
      
      case '/actuator/prometheus':
        const prometheus = await actuator.getPrometheusMetrics();
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(prometheus);
        break;
      
      default:
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
  console.log('Actuator endpoints available at /actuator/*');
});
```

## Adding Real Health Checks

### Database Health Check

```typescript
import { LightweightActuator } from 'node-actuator-lite';

const actuator = new LightweightActuator({
  port: 3001,
  customHealthChecks: [
    // PostgreSQL health check
    async () => {
      try {
        const { Client } = require('pg');
        const client = new Client({
          connectionString: process.env.DATABASE_URL
        });
        
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        
        return {
          status: 'UP',
          details: { database: 'PostgreSQL', connected: true }
        };
      } catch (error) {
        return {
          status: 'DOWN',
          details: { 
            database: 'PostgreSQL', 
            error: error.message 
          }
        };
      }
    },
    
    // Redis health check
    async () => {
      try {
        const redis = require('redis');
        const client = redis.createClient({
          url: process.env.REDIS_URL
        });
        
        await client.connect();
        await client.ping();
        await client.disconnect();
        
        return {
          status: 'UP',
          details: { cache: 'Redis', connected: true }
        };
      } catch (error) {
        return {
          status: 'DOWN',
          details: { 
            cache: 'Redis', 
            error: error.message 
          }
        };
      }
    }
  ]
});

await actuator.start();
```

### External API Health Check

```typescript
const actuator = new LightweightActuator({
  port: 3001,
  customHealthChecks: [
    async () => {
      try {
        const response = await fetch('https://api.external-service.com/health');
        
        if (response.ok) {
          return {
            status: 'UP',
            details: { 
              service: 'External API',
              responseTime: response.headers.get('x-response-time'),
              statusCode: response.status
            }
          };
        } else {
          return {
            status: 'DOWN',
            details: { 
              service: 'External API',
              statusCode: response.status,
              error: 'Service returned non-OK status'
            }
          };
        }
      } catch (error) {
        return {
          status: 'DOWN',
          details: { 
            service: 'External API',
            error: error.message 
          }
        };
      }
    }
  ]
});
```

### Serverless-Specific Health Checks

```typescript
const actuator = new LightweightActuator({
  port: 0,
  customHealthChecks: [
    // Check environment variables (important for serverless)
    async () => {
      const requiredEnvVars = ['DATABASE_URL', 'API_KEY', 'NODE_ENV'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length === 0) {
        return {
          status: 'UP',
          details: { environment: 'All required variables present' }
        };
      } else {
        return {
          status: 'DOWN',
          details: { 
            environment: 'Missing required variables',
            missing: missingVars
          }
        };
      }
    },
    
    // Check function timeout (serverless-specific)
    async () => {
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
      const duration = Date.now() - startTime;
      
      return {
        status: 'UP',
        details: { 
          performance: 'Function responding within limits',
          responseTime: `${duration}ms`
        }
      };
    }
  ]
});
```

## Custom Metrics

### Adding Custom Prometheus Metrics

```typescript
import { LightweightActuator } from 'node-actuator-lite';

const actuator = new LightweightActuator({
  port: 3001,
  customMetrics: [
    {
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      type: 'counter'
    },
    {
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      type: 'histogram'
    },
    {
      name: 'active_connections',
      help: 'Number of active database connections',
      type: 'gauge'
    }
  ]
});

await actuator.start();

// Use the metrics in your application
const requestCounter = actuator.getCustomMetric('http_requests_total');
const requestDuration = actuator.getCustomMetric('http_request_duration_seconds');
const activeConnections = actuator.getCustomMetric('active_connections');

// Increment counter
requestCounter.inc();

// Record duration
requestDuration.observe(0.15);

// Set gauge value
activeConnections.set(5);
```

### Serverless-Specific Metrics

```typescript
const actuator = new LightweightActuator({
  port: 0,
  customMetrics: [
    {
      name: 'function_invocations_total',
      help: 'Total number of function invocations',
      type: 'counter'
    },
    {
      name: 'function_duration_seconds',
      help: 'Function execution duration',
      type: 'histogram'
    },
    {
      name: 'cold_starts_total',
      help: 'Total number of cold starts',
      type: 'counter'
    },
    {
      name: 'memory_usage_bytes',
      help: 'Current memory usage in bytes',
      type: 'gauge'
    }
  ]
});

// Track function invocations
const invocationsCounter = actuator.getCustomMetric('function_invocations_total');
const durationHistogram = actuator.getCustomMetric('function_duration_seconds');
const coldStartsCounter = actuator.getCustomMetric('cold_starts_total');
const memoryGauge = actuator.getCustomMetric('memory_usage_bytes');

// In your function handler
export const handler = async (event, context) => {
  const startTime = Date.now();
  
  // Increment invocation counter
  invocationsCounter.inc();
  
  // Check if this is a cold start
  if (context.getRemainingTimeInMillis() === context.getRemainingTimeInMillis()) {
    coldStartsCounter.inc();
  }
  
  try {
    // Your function logic here
    const result = await processEvent(event);
    
    // Record duration
    const duration = (Date.now() - startTime) / 1000;
    durationHistogram.observe(duration);
    
    // Update memory usage
    const memUsage = process.memoryUsage();
    memoryGauge.set(memUsage.heapUsed);
    
    return result;
  } catch (error) {
    // Handle errors
    throw error;
  }
};
```

## Configuration Options

### Full Configuration Example

```typescript
import { LightweightActuator } from 'node-actuator-lite';

const actuator = new LightweightActuator({
  // Server configuration
  port: 3001,                    // Port number (0 for dynamic)
  basePath: '/actuator',         // Base path for endpoints
  
  // Enable/disable features
  enableHealth: true,            // Health endpoint
  enableMetrics: true,           // Metrics endpoint
  enablePrometheus: true,        // Prometheus metrics
  enableInfo: true,              // Info endpoint
  enableEnv: true,               // Environment endpoint
  enableThreadDump: true,        // Thread dump endpoint
  enableHeapDump: true,          // Heap dump endpoint
  
  // Custom health checks
  customHealthChecks: [
    async () => ({ status: 'UP', details: { custom: 'check' } })
  ],
  
  // Custom metrics
  customMetrics: [
    { name: 'custom_counter', help: 'A custom counter', type: 'counter' }
  ],
  
  // Health check options
  healthOptions: {
    includeDiskSpace: true,      // Include disk space check
    includeProcess: true,        // Include process check
    diskSpaceThreshold: 90,      // Disk space threshold (%)
    diskSpacePath: '/',          // Path to check disk space
    healthCheckTimeout: 5000     // Health check timeout (ms)
  }
});

await actuator.start();
```

## Available Endpoints

Once started, the actuator provides these endpoints:

### Health & Monitoring
- `GET /actuator/health` - Application health status
- `GET /actuator/metrics` - Application metrics (JSON format)
- `GET /actuator/prometheus` - Prometheus metrics format

### Information
- `GET /actuator/info` - Application information
- `GET /actuator/env` - Environment variables

### Advanced Diagnostics
- `GET /actuator/threaddump` - Detailed thread dump analysis
- `GET /actuator/heapdump` - V8 heap snapshot and memory analysis

### Example Responses

**Health Check Response:**
```json
{
  "status": "UP",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "pid": 12345,
  "details": {
    "disk": {
      "status": "UP",
      "freeSpace": 107374182400,
      "totalSpace": 1073741824000
    },
    "process": {
      "status": "UP",
      "uptime": 3600,
      "memoryUsage": {
        "rss": 52428800,
        "heapTotal": 20971520,
        "heapUsed": 10485760
      }
    },
    "checks": [
      {
        "name": "database",
        "status": "UP",
        "details": { "database": "PostgreSQL", "connected": true }
      }
    ]
  }
}
```

**Metrics Response:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "system": {
    "hostname": "server-1",
    "platform": "linux",
    "arch": "x64",
    "nodeVersion": "v18.0.0",
    "totalMemory": 8589934592,
    "freeMemory": 4294967296,
    "loadAverage": [1.5, 1.2, 1.0],
    "cpuCount": 8,
    "uptime": 86400
  },
  "process": {
    "pid": 12345,
    "uptime": 3600,
    "version": "v18.0.0",
    "memoryUsage": {
      "rss": 52428800,
      "heapTotal": 20971520,
      "heapUsed": 10485760,
      "external": 2097152
    },
    "cpuUsage": {
      "user": 1000000,
      "system": 500000
    }
  }
}
```

## Best Practices

### 1. Error Handling

```typescript
try {
  await actuator.start();
  console.log(`Actuator started on port ${actuator.getPort()}`);
} catch (error) {
  console.error('Failed to start actuator:', error);
  process.exit(1);
}
```

### 2. Graceful Shutdown

```typescript
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await actuator.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await actuator.stop();
  process.exit(0);
});
```

### 3. Environment-Specific Configuration

```typescript
const actuator = new LightweightActuator({
  port: process.env.ACTUATOR_PORT || 3001,
  basePath: process.env.ACTUATOR_BASE_PATH || '/actuator',
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: process.env.NODE_ENV === 'production',
  enableThreadDump: process.env.NODE_ENV === 'development',
  enableHeapDump: process.env.NODE_ENV === 'development',
  customHealthChecks: [
    // Add environment-specific health checks
    ...(process.env.NODE_ENV === 'production' ? [productionHealthCheck] : [])
  ]
});
```

### 4. Security Considerations

- Use environment variables for sensitive configuration
- Consider adding authentication for production deployments
- Use HTTPS in production environments
- Limit access to actuator endpoints in production
- For serverless, use API Gateway authentication or similar

### 5. Serverless Best Practices

```typescript
// Initialize actuator once (outside handler)
const actuator = new LightweightActuator({
  port: 0,
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true
});

// Reuse in multiple function invocations
export const handler = async (event, context) => {
  // Use actuator methods without starting server
  const health = await actuator.getHealth();
  const metrics = await actuator.getMetrics();
  
  // Your function logic here
  return { health, metrics };
};
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```typescript
   const actuator = new LightweightActuator({
     port: 0  // Use dynamic port
   });
   ```

2. **Health Checks Failing**
   - Check if external services are accessible
   - Verify database connection strings
   - Ensure proper error handling in custom health checks

3. **Metrics Not Updating**
   - Verify custom metrics are properly registered
   - Check if metrics are being incremented/updated in your code
   - Ensure Prometheus client is properly configured

4. **Serverless Issues**
   - Don't start the internal server in serverless environments
   - Use `port: 0` configuration
   - Initialize actuator outside the handler function
   - Handle cold starts appropriately

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
LOG_LEVEL=DEBUG node your-app.js
```

This will provide detailed logging about actuator operations, health checks, and metrics collection.

### Serverless Debug

For serverless platforms, add logging to your handler:

```typescript
export const handler = async (event, context) => {
  console.log('Function invoked:', { event, context });
  
  try {
    const health = await actuator.getHealth();
    console.log('Health check result:', health);
    return health;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};
``` 
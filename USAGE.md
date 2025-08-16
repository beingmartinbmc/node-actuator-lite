# Node Actuator Lite - Usage Guide

This guide provides comprehensive examples and integration patterns for using Node Actuator Lite in various environments.

## Table of Contents

- [Standalone Mode](#standalone-mode)
- [Serverless Mode](#serverless-mode)
- [Health Checks](#health-checks)
- [Custom Metrics](#custom-metrics)
- [Integration Examples](#integration-examples)
- [Best Practices](#best-practices)

## Standalone Mode

### Basic Standalone Setup

```typescript
import { LightweightActuator } from 'node-actuator-lite';

const actuator = new LightweightActuator({
  port: 3001,
  serverless: false,
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true
});

await actuator.start();
console.log(`Actuator running on port ${actuator.getPort()}`);
```

### Advanced Standalone Configuration

```typescript
import { LightweightActuator } from 'node-actuator-lite';

const actuator = new LightweightActuator({
  port: 3001,
  serverless: false,
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
  }
});

await actuator.start();
```

### Testing Standalone Endpoints

```bash
# Health check
curl http://localhost:3001/actuator/health

# Metrics
curl http://localhost:3001/actuator/metrics

# Prometheus metrics
curl http://localhost:3001/actuator/prometheus

# Thread dump
curl http://localhost:3001/actuator/threaddump

# Heap dump
curl http://localhost:3001/actuator/heapdump
```

## Serverless Mode

### Basic Serverless Setup

```typescript
import { LightweightActuator } from 'node-actuator-lite';

const actuator = new LightweightActuator({
  serverless: true,
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true
});

// Initialize (no server started)
await actuator.start();

// Use direct data access methods
const health = await actuator.getHealth();
const metrics = await actuator.getMetrics();
const prometheus = await actuator.getPrometheusMetrics();
```

### Vercel Integration

#### API Route Setup

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
  customHealthChecks: [
    {
      name: 'database',
      check: async () => {
        // Your database health check
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
      default:
        res.status(404).json({ 
          error: 'Endpoint not found',
          availableEndpoints: ['health', 'metrics', 'prometheus', 'info', 'env', 'threaddump']
        });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

#### Vercel Configuration

```json
// vercel.json
{
  "functions": {
    "api/actuator/[...path].ts": {
      "maxDuration": 30
    }
  }
}
```

### AWS Lambda Integration

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
      default:
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Endpoint not found' })
        };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
```

### Netlify Functions Integration

```typescript
// netlify/functions/actuator.ts
import { LightweightActuator } from 'node-actuator-lite';
import type { Handler } from '@netlify/functions';

const actuator = new LightweightActuator({
  serverless: true,
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true
});

export const handler: Handler = async (event) => {
  const path = event.path.replace('/.netlify/functions/actuator/', '');
  
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

## Health Checks

### Built-in Health Checks

The actuator includes built-in health checks for disk space and process health:

```typescript
const actuator = new LightweightActuator({
  healthOptions: {
    includeDiskSpace: true,        // Monitor disk space
    includeProcess: true,          // Monitor process health
    diskSpaceThreshold: 10 * 1024 * 1024 * 1024, // 10GB minimum
    diskSpacePath: process.cwd(),  // Path to monitor
    healthCheckTimeout: 5000       // 5 second timeout
  }
});
```

### Custom Health Checks

#### Named Health Checks (Recommended)

```typescript
const actuator = new LightweightActuator({
  customHealthChecks: [
    {
      name: 'database',
      check: async () => {
        try {
          // Database connection check
          const connection = await db.ping();
          return {
            status: 'UP',
            details: {
              connection: 'established',
              responseTime: connection.responseTime
            }
          };
        } catch (error) {
          return {
            status: 'DOWN',
            details: {
              error: error.message,
              connection: 'failed'
            }
          };
        }
      }
    },
    {
      name: 'external-api',
      check: async () => {
        try {
          const response = await fetch('https://api.example.com/health');
          const data = await response.json();
          
          return {
            status: response.ok ? 'UP' : 'DOWN',
            details: {
              endpoint: 'https://api.example.com/health',
              responseTime: response.headers.get('x-response-time'),
              statusCode: response.status
            }
          };
        } catch (error) {
          return {
            status: 'DOWN',
            details: {
              error: error.message,
              endpoint: 'https://api.example.com/health'
            }
          };
        }
      }
    },
    {
      name: 'redis',
      check: async () => {
        try {
          const redis = require('redis');
          const client = redis.createClient();
          await client.ping();
          await client.quit();
          
          return {
            status: 'UP',
            details: {
              connection: 'established'
            }
          };
        } catch (error) {
          return {
            status: 'DOWN',
            details: {
              error: error.message
            }
          };
        }
      }
    }
  ]
});
```

#### Legacy Function Health Checks

```typescript
const actuator = new LightweightActuator({
  customHealthChecks: [
    async () => {
      // Simple health check
      return { status: 'UP', details: { message: 'All systems operational' } };
    },
    async () => {
      // Another health check
      return { status: 'UP', details: { uptime: process.uptime() } };
    }
  ]
});
```

### Health Check Response Format

```json
{
  "status": "UP",
  "details": {
    "checks": [
      {
        "name": "diskSpace",
        "status": "UP",
        "details": {
          "total": 500000000000,
          "free": 300000000000,
          "threshold": 10737418240,
          "path": "/app"
        }
      },
      {
        "name": "database",
        "status": "UP",
        "details": {
          "connection": "established",
          "responseTime": 15
        }
      }
    ],
    "responseTime": "25.50ms"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5
}
```

## Custom Metrics

### Defining Custom Metrics

```typescript
const actuator = new LightweightActuator({
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
    },
    {
      name: 'app_error_rate',
      help: 'Application error rate percentage',
      type: 'gauge'
    }
  ]
});
```

### Using Custom Metrics

```typescript
// Get metric instances
const requestCounter = actuator.getCustomMetric('app_requests_total');
const responseTimeHistogram = actuator.getCustomMetric('app_response_time_seconds');
const activeUsersGauge = actuator.getCustomMetric('app_active_users');
const errorRateGauge = actuator.getCustomMetric('app_error_rate');

// Increment counter
requestCounter.inc();

// Increment with labels
requestCounter.inc({ method: 'GET', endpoint: '/api/users' });

// Record histogram
responseTimeHistogram.observe(0.15); // 150ms

// Set gauge value
activeUsersGauge.set(42);

// Update error rate
errorRateGauge.set(2.5); // 2.5%
```

### Metrics in Prometheus Format

```prometheus
# HELP app_requests_total Total number of application requests
# TYPE app_requests_total counter
app_requests_total{method="GET",endpoint="/api/users"} 150

# HELP app_response_time_seconds Application response time in seconds
# TYPE app_response_time_seconds histogram
app_response_time_seconds_bucket{le="0.1"} 45
app_response_time_seconds_bucket{le="0.5"} 120
app_response_time_seconds_bucket{le="1"} 150
app_response_time_seconds_sum 75.5
app_response_time_seconds_count 150

# HELP app_active_users Number of active users
# TYPE app_active_users gauge
app_active_users 42

# HELP app_error_rate Application error rate percentage
# TYPE app_error_rate gauge
app_error_rate 2.5
```

## Integration Examples

### Framework-Agnostic Approach

Node Actuator Lite is designed to be **framework-agnostic** and **serverless-first**. Instead of providing framework-specific middleware, it offers direct data access methods that work with any Node.js environment.

### Standalone HTTP Server

For traditional applications that can start their own HTTP server:

```typescript
import { LightweightActuator } from 'node-actuator-lite';

const actuator = new LightweightActuator({
  port: 3001,
  serverless: false,
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true
});

await actuator.start();
console.log(`Actuator running on port ${actuator.getPort()}`);
```

### Serverless Integration (Recommended)

For serverless platforms like Vercel, AWS Lambda, or Netlify:

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

### Custom Framework Integration

If you need to integrate with a specific framework, use the direct data access methods:

```typescript
// Example: Any framework can use these methods
const health = await actuator.getHealth();
const metrics = await actuator.getMetrics();
const prometheus = await actuator.getPrometheusMetrics();
const info = await actuator.getInfo();
const env = await actuator.getEnvironment();
const threadDump = actuator.getThreadDump();
const heapDump = await actuator.getHeapDump();
```

## Best Practices

### 1. Environment Detection

```typescript
// Auto-detect serverless environments
const isServerless = process.env['VERCEL_ENV'] || 
                    process.env['NETLIFY'] || 
                    process.env['AWS_LAMBDA_FUNCTION_NAME'];

const actuator = new LightweightActuator({
  serverless: isServerless,
  // ... other options
});
```

### 2. Error Handling

```typescript
// Always handle errors in health checks
customHealthChecks: [
  {
    name: 'database',
    check: async () => {
      try {
        // Health check logic
        return { status: 'UP', details: { connection: 'ok' } };
      } catch (error) {
        return { 
          status: 'DOWN', 
          details: { error: error.message } 
        };
      }
    }
  }
]
```

### 3. Timeout Management

```typescript
// Set appropriate timeouts for health checks
const actuator = new LightweightActuator({
  healthOptions: {
    healthCheckTimeout: 3000, // 3 seconds
    // ... other options
  }
});
```

### 4. Metric Naming

```typescript
// Use consistent metric naming conventions
customMetrics: [
  {
    name: 'app_http_requests_total',     // Use underscores, not hyphens
    help: 'Total number of HTTP requests',
    type: 'counter'
  },
  {
    name: 'app_http_request_duration_seconds', // Include units
    help: 'HTTP request duration in seconds',
    type: 'histogram'
  }
]
```

### 5. Security Considerations

```typescript
// In production, consider authentication for actuator endpoints
app.get('/actuator/*', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ACTUATOR_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

### 6. Performance Optimization

```typescript
// Cache expensive health checks
let cachedHealthCheck: any = null;
let lastCheck = 0;
const CACHE_DURATION = 30000; // 30 seconds

customHealthChecks: [
  {
    name: 'expensive-service',
    check: async () => {
      const now = Date.now();
      if (cachedHealthCheck && (now - lastCheck) < CACHE_DURATION) {
        return cachedHealthCheck;
      }
      
      // Expensive health check logic
      const result = await expensiveHealthCheck();
      cachedHealthCheck = result;
      lastCheck = now;
      return result;
    }
  }
]
```

### 7. Monitoring Integration

```typescript
// Integrate with monitoring systems
const actuator = new LightweightActuator({
  customMetrics: [
    {
      name: 'app_business_metric',
      help: 'Key business metric',
      type: 'gauge'
    }
  ]
});

// Update business metrics
const businessMetric = actuator.getCustomMetric('app_business_metric');
setInterval(() => {
  const value = calculateBusinessMetric();
  businessMetric.set(value);
}, 60000); // Update every minute
```

This comprehensive usage guide covers all aspects of Node Actuator Lite, from basic setup to advanced integration patterns and best practices.

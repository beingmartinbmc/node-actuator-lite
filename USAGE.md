# Node Actuator Lite - Usage Guide

## Quick Start

```typescript
import { Actuator } from 'node-actuator-lite';

// Create actuator instance
const actuator = new Actuator({
  port: 3001,
  basePath: '/actuator'
});

// Add your health checks
actuator.addDatabaseHealthCheck('postgres', async () => {
  // Your database health check logic here
  return { status: 'UP', details: { database: 'PostgreSQL' } };
});

// Start the actuator
actuator.start();
```

## Integration with Express App

```typescript
import express from 'express';
import { Actuator } from 'node-actuator-lite';

const app = express();

// Your existing routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello World!' });
});

// Start your main app
app.listen(3000, () => {
  console.log('Main app running on port 3000');
});

// Start actuator on different port
const actuator = new Actuator({ port: 3001 });
actuator.start().then(() => {
  console.log('Actuator running on port 3001');
});
```

## Adding Real Health Checks

### Database Health Check
```typescript
actuator.addDatabaseHealthCheck('postgres', async () => {
  try {
    const { Client } = require('pg');
    const client = new Client({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });
    await client.connect();
    const result = await client.query('SELECT 1');
    await client.end();
    
    return { 
      status: 'UP', 
      details: { 
        database: 'PostgreSQL',
        validationQuery: 'SELECT 1'
      } 
    };
  } catch (error) {
    return { 
      status: 'DOWN', 
      details: { error: error.message } 
    };
  }
});
```

### Redis Health Check
```typescript
actuator.addCacheHealthCheck('redis', async () => {
  try {
    const redis = require('redis');
    const client = redis.createClient({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT
    });
    await client.connect();
    const result = await client.ping();
    await client.disconnect();
    
    return { 
      status: 'UP', 
      details: { version: '6.2.0' } 
    };
  } catch (error) {
    return { 
      status: 'DOWN', 
      details: { error: error.message } 
    };
  }
});
```

### External API Health Check
```typescript
actuator.addExternalServiceHealthCheck('payment-api', async () => {
  try {
    const response = await fetch('https://api.payment.com/health');
    if (response.ok) {
      return { 
        status: 'UP', 
        details: { url: 'https://api.payment.com/health' } 
      };
    } else {
      return { 
        status: 'DOWN', 
        details: { error: `HTTP ${response.status}` } 
      };
    }
  } catch (error) {
    return { 
      status: 'DOWN', 
      details: { error: error.message } 
    };
  }
});
```

## Adding Custom Metrics

```typescript
// Add custom metrics
const requestCounter = actuator.addCustomMetric(
  'http_requests_total',
  'Total number of HTTP requests',
  'counter',
  { labelNames: ['method', 'route', 'status_code'] }
);

const responseTimeHistogram = actuator.addCustomMetric(
  'http_request_duration_seconds',
  'HTTP request duration in seconds',
  'histogram',
  { labelNames: ['method', 'route'] }
);

// Use metrics in your middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    requestCounter.inc({ 
      method: req.method, 
      route: req.path, 
      status_code: res.statusCode.toString() 
    });
    
    responseTimeHistogram.observe({ 
      method: req.method, 
      route: req.path 
    }, duration);
  });
  
  next();
});
```

## Available Endpoints

Once started, the actuator provides these endpoints:

- `GET /actuator` - Root endpoint with available links
- `GET /actuator/health` - Health check status
- `GET /actuator/metrics` - Application metrics
- `GET /actuator/prometheus` - Prometheus metrics
- `GET /actuator/info` - Application information
- `GET /actuator/env` - Environment information
- `GET /actuator/mappings` - Route mappings
- `GET /actuator/modules` - Node.js modules information
- `GET /actuator/configprops` - Configuration properties
- `GET /actuator/threaddump` - Thread dump information
- `GET /actuator/heapdump` - Heap dump information

## Health Check Response Format

The health endpoint returns a response similar to Spring Boot Actuator:

```json
{
  "status": "UP",
  "components": {
    "diskSpace": {
      "status": "UP",
      "details": {
        "total": 76887154688,
        "free": 50919591936,
        "threshold": 10485760,
        "path": "/app",
        "exists": true
      }
    },
    "postgres": {
      "status": "UP",
      "details": {
        "database": "PostgreSQL",
        "validationQuery": "SELECT 1"
      }
    },
    "redis": {
      "status": "UP",
      "details": {
        "version": "6.2.0"
      }
    }
  }
}
```

## Configuration Options

```typescript
const actuator = new Actuator({
  port: 3001,                    // Default: 3001
  basePath: '/actuator',         // Default: '/actuator'
  enableHealth: true,            // Default: true
  enableMetrics: true,           // Default: true
  enableInfo: true,              // Default: true
  enableEnv: true,               // Default: true
  enablePrometheus: true,        // Default: true
  enableMappings: true,          // Default: true
  enableBeans: true,             // Default: true
  enableConfigProps: true,       // Default: true
  enableThreadDump: true,        // Default: true
  enableHeapDump: true,          // Default: true
  healthOptions: {
    includeDiskSpace: true,      // Default: true
    includeProcess: true,        // Default: true
    diskSpaceThreshold: 10 * 1024 * 1024, // 10MB default
    diskSpacePath: process.cwd() // Current working directory
  }
});
``` 
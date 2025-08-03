# Vercel Integration Example

This example demonstrates how to use `node-actuator-lite` with Vercel's serverless architecture using the new `ActuatorMiddleware`.

## Problem

The original `Actuator` class creates its own Express server and runs on a separate port, which doesn't work well with Vercel's serverless architecture because:

- Vercel expects individual serverless functions in the `api/` directory
- Each function should handle its own routes
- The actuator library wants to run as a standalone server

## Solution

The new `ActuatorMiddleware` class provides the same functionality as `Actuator` but integrates with existing Express applications, similar to how Spring Boot Actuator works. **It's designed to be serverless-friendly with all configuration done upfront in the constructor.**

## Key Differences

| Feature | Standalone (`Actuator`) | Integration (`ActuatorMiddleware`) |
|---------|------------------------|-----------------------------------|
| Server | Creates own Express server | Uses existing Express app |
| Port | Separate port | Same port as main app |
| Deployment | Traditional servers, Docker, K8s | Serverless, Vercel, Express apps |
| Usage | `actuator.start()` | `app.use(actuatorMiddleware.getRouter())` |
| Configuration | Runtime API calls | All upfront in constructor |
| API Design | Instance methods | Constructor-only configuration |

## Usage Examples

### 1. Express Application Integration (Serverless-Friendly)

```typescript
import express from 'express';
import { ActuatorMiddleware } from 'node-actuator-lite';

const app = express();

// Configure everything upfront - no runtime API calls needed!
const actuatorMiddleware = new ActuatorMiddleware({
  basePath: '/actuator',
  enableHealth: true,
  enableMetrics: true,
  // Serverless-friendly health checks configuration
  healthChecks: [
    {
      name: 'database',
      check: async () => ({ status: 'UP', details: { connected: true } }),
      enabled: true,
      critical: true
    },
    {
      name: 'email-service',
      check: async () => ({ status: 'UP', details: { sent: 10, failed: 1 } }),
      enabled: true,
      critical: false
    }
  ],
  // Serverless-friendly metrics configuration
  customMetrics: [
    { 
      name: 'api_requests_total', 
      help: 'Total number of API requests', 
      type: 'counter',
      labelNames: ['method', 'endpoint']
    }
  ],
  // Serverless-friendly route registration
  routes: [
    { method: 'GET', path: '/api/users', handler: 'Get Users Handler' },
    { method: 'POST', path: '/api/users', handler: 'Create User Handler' }
  ]
});

// Add actuator routes to your Express app
app.use(actuatorMiddleware.getRouter());

// Your business logic routes
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000, () => {
  console.log('App running on port 3000');
  console.log('Actuator available at /actuator');
});
```

### 2. Vercel Serverless Functions

Create a catch-all API route at `api/actuator/[...path].ts`:

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { ActuatorMiddleware } from 'node-actuator-lite';

// Configure everything upfront for serverless
const actuatorMiddleware = new ActuatorMiddleware({
  basePath: '/api/actuator',
  enableHealth: true,
  enableMetrics: true,
  enableHeapDump: false, // Disable in serverless
  healthChecks: [
    {
      name: 'database',
      check: async () => ({ status: 'UP', details: { connected: true } }),
      enabled: true,
      critical: true
    }
  ],
  healthOptions: {
    includeDiskSpace: false, // Disable in serverless
  }
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const pathString = Array.isArray(path) ? path.join('/') : path || '';
  
  // Route to appropriate actuator endpoint
  switch (pathString) {
    case 'health':
      // Handle health check
      break;
    case 'metrics':
      // Handle metrics
      break;
    // ... other endpoints
  }
}
```

## Configuration Options

The `ActuatorMiddlewareOptions` interface is designed for serverless use:

```typescript
interface ActuatorMiddlewareOptions {
  basePath?: string;
  enableHealth?: boolean;
  enableMetrics?: boolean;
  // ... other enable flags
  
  // Serverless-friendly configuration - everything configured upfront
  healthChecks?: Array<{
    name: string;
    check: () => Promise<{ status: string; details?: any }>;
    enabled?: boolean;
    critical?: boolean;
  }>;
  customMetrics?: Array<{
    name: string;
    help: string;
    type: 'counter' | 'gauge' | 'histogram';
    labelNames?: string[];
  }>;
  customBeans?: Record<string, any>;
  customConfigProps?: Record<string, any>;
  routes?: Array<{ method: string; path: string; handler: string }>;
}
```

### Serverless-Specific Recommendations

1. **Disable Heap Dumps**: Set `enableHeapDump: false` (not relevant in serverless)
2. **Disable Disk Space Checks**: Set `healthOptions.includeDiskSpace: false`
3. **Configure Everything Upfront**: Use constructor options instead of runtime API calls
4. **Use Environment Variables**: Configure endpoints using environment variables for different deployment stages
5. **Keep Health Checks Lightweight**: Avoid cold start penalties

## Available Endpoints

When using the middleware, all actuator endpoints are available under your configured `basePath`:

- `GET /actuator/health` - Health check
- `GET /actuator/metrics` - Application metrics
- `GET /actuator/prometheus` - Prometheus metrics
- `GET /actuator/info` - Application info
- `GET /actuator/env` - Environment variables
- `GET /actuator/threaddump` - Thread dump
- `GET /actuator/mappings` - Route mappings
- `GET /actuator/beans` - Application beans
- `GET /actuator/configprops` - Configuration properties

## Migration from Actuator to ActuatorMiddleware

If you're migrating from the standalone `Actuator` to `ActuatorMiddleware`:

1. Replace `Actuator` import with `ActuatorMiddleware`
2. Remove the `port` option from configuration
3. Replace runtime API calls with constructor configuration:
   ```typescript
   // Old way (runtime API calls)
   const actuator = new Actuator(options);
   actuator.addHealthIndicator('db', dbCheck);
   actuator.addCustomMetric('requests', 'help', 'counter');
   await actuator.start();
   
   // New way (constructor configuration)
   const actuatorMiddleware = new ActuatorMiddleware({
     ...options,
     healthChecks: [{ name: 'db', check: dbCheck }],
     customMetrics: [{ name: 'requests', help: 'help', type: 'counter' }]
   });
   app.use(actuatorMiddleware.getRouter());
   ```
4. Remove any port-specific logic

## Benefits

- **Vercel Compatible**: Works seamlessly with Vercel's serverless architecture
- **Spring Boot Similar**: Follows the same pattern as Spring Boot Actuator
- **Serverless Optimized**: All configuration done upfront, no runtime API calls
- **Same Functionality**: All actuator features are available
- **Flexible**: Can be used with any Express-based application
- **Lightweight**: No additional server overhead
- **Stateless**: Perfect for serverless environments

## Example Files

- `vercel-integration-demo.ts` - Complete Express application example
- `api/actuator/[...path].ts` - Vercel serverless function example
- `api/health.ts` - Simple health check endpoint example 
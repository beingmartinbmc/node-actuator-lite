# Vercel Integration Example

This example demonstrates how to use `node-actuator-lite` with Vercel's serverless architecture using the new `ActuatorMiddleware`.

## Problem

The original `Actuator` class creates its own Express server and runs on a separate port, which doesn't work well with Vercel's serverless architecture because:

- Vercel expects individual serverless functions in the `api/` directory
- Each function should handle its own routes
- The actuator library wants to run as a standalone server

## Solution

The new `ActuatorMiddleware` class provides the same functionality as `Actuator` but integrates with existing Express applications, similar to how Spring Boot Actuator works.

## Key Differences

| Feature | Actuator (Standalone) | ActuatorMiddleware (Integration) |
|---------|----------------------|----------------------------------|
| Server | Creates its own Express server | Uses existing Express app |
| Port | Runs on separate port | Uses same port as main app |
| Deployment | Traditional servers, Docker, K8s | Serverless, Vercel, etc. |
| Usage | `actuator.start()` | `app.use(actuatorMiddleware.getRouter())` |

## Usage Examples

### 1. Express Application Integration

```typescript
import express from 'express';
import { ActuatorMiddleware } from 'node-actuator-lite';

const app = express();

// Create actuator middleware
const actuatorMiddleware = new ActuatorMiddleware({
  basePath: '/actuator',
  enableHealth: true,
  enableMetrics: true,
  // ... other options
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

const actuatorMiddleware = new ActuatorMiddleware({
  basePath: '/api/actuator',
  enableHealth: true,
  enableMetrics: true,
  enableHeapDump: false, // Disable in serverless
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

The `ActuatorMiddlewareOptions` interface is identical to `ActuatorOptions` except for the `port` property, which is not needed for middleware.

### Serverless-Specific Recommendations

1. **Disable Heap Dumps**: Set `enableHeapDump: false` as heap dumps don't make sense in serverless environments.

2. **Disable Disk Space Checks**: Set `healthOptions.includeDiskSpace: false` as disk space is not relevant in serverless.

3. **Use Environment Variables**: Configure endpoints using environment variables for different deployment stages.

4. **Optimize for Cold Starts**: Keep health checks lightweight to avoid cold start penalties.

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
3. Replace `actuator.start()` with `app.use(actuatorMiddleware.getRouter())`
4. Remove any port-specific logic

## Benefits

- **Vercel Compatible**: Works seamlessly with Vercel's serverless architecture
- **Spring Boot Similar**: Follows the same pattern as Spring Boot Actuator
- **Same Functionality**: All actuator features are available
- **Flexible**: Can be used with any Express-based application
- **Lightweight**: No additional server overhead

## Example Files

- `vercel-integration-demo.ts` - Complete Express application example
- `api/actuator/[...path].ts` - Vercel serverless function example
- `api/health.ts` - Simple health check endpoint example 
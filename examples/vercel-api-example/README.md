# Vercel Integration Example

This example demonstrates how to use `node-actuator-lite` with Vercel's serverless architecture using individual API routes.

## Problem

The original `Actuator` class creates its own Express server and runs on a separate port, which doesn't work well with Vercel's serverless architecture because:

- Vercel expects individual serverless functions in the `api/` directory
- Each function should handle its own routes
- The actuator library wants to run as a standalone server

## Solution

For Vercel serverless functions, you need to create **individual API routes** for each actuator endpoint. The `ActuatorMiddleware` is designed for Express applications, but for Vercel, you should use the individual collectors directly.

## Correct Implementation for Vercel

### 1. Individual API Routes (Recommended for Vercel)

Create separate files for each actuator endpoint:

```typescript
// api/actuator-serverless/health.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { HealthChecker } from 'node-actuator-lite';

const healthChecker = new HealthChecker([
  {
    name: 'database',
    check: async () => ({ status: 'UP', details: { connected: true } }),
    enabled: true,
    critical: true
  }
], {
  includeDiskSpace: false, // Disable in serverless
  includeProcess: true
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const health = await healthChecker.check();
    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({ error: 'Health check failed' });
  }
}
```

```typescript
// api/actuator-serverless/metrics.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { MetricsCollector } from 'node-actuator-lite';

const metricsCollector = new MetricsCollector();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const metrics = await metricsCollector.collect();
    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Metrics collection failed' });
  }
}
```

### 2. Available Endpoints

When deployed to Vercel, these endpoints will be available at:

- `GET /api/actuator-serverless` - Root endpoint with available links
- `GET /api/actuator-serverless/health` - Health check
- `GET /api/actuator-serverless/metrics` - Application metrics
- `GET /api/actuator-serverless/info` - Application info
- `GET /api/actuator-serverless/env` - Environment variables

### 3. File Structure

```
api/
├── actuator-serverless/
│   ├── index.ts          # Root endpoint
│   ├── health.ts         # Health check
│   ├── metrics.ts        # Metrics
│   ├── info.ts           # Application info
│   ├── env.ts            # Environment variables
│   ├── prometheus.ts     # Prometheus metrics
│   ├── threaddump.ts     # Thread dump
│   ├── mappings.ts       # Route mappings
│   ├── beans.ts          # Application beans
│   └── configprops.ts    # Configuration properties
```

## Key Differences

| Approach | Use Case | Implementation |
|----------|----------|----------------|
| **Individual API Routes** | Vercel Serverless | Separate files for each endpoint |
| **ActuatorMiddleware** | Express Applications | Single middleware with router |

## Configuration Options

Each endpoint can be configured independently:

```typescript
// Health endpoint configuration
const healthChecker = new HealthChecker([
  {
    name: 'database',
    check: async () => await databaseService.healthCheck(),
    enabled: true,
    critical: true
  },
  {
    name: 'email-service',
    check: async () => await emailService.healthCheck(),
    enabled: true,
    critical: false
  }
], {
  includeDiskSpace: false, // Disable in serverless
  includeProcess: true,
  healthCheckTimeout: 5000
});
```

## Serverless-Specific Recommendations

1. **Disable Disk Space Checks**: Set `includeDiskSpace: false` in health options
2. **Keep Health Checks Lightweight**: Avoid cold start penalties
3. **Use Environment Variables**: Configure endpoints using Vercel environment variables
4. **Handle Errors Gracefully**: Always wrap in try-catch blocks
5. **Add Vercel Metadata**: Include region, environment, and function name in responses

## Example Response

```json
{
  "status": "UP",
  "details": {
    "checks": [
      {
        "name": "database",
        "status": "UP",
        "details": { "connected": true, "responseTime": 45 }
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "deployment": "vercel-serverless",
  "function": "actuator-serverless-health"
}
```

## Benefits

- **Vercel Native**: Works seamlessly with Vercel's serverless architecture
- **Individual Functions**: Each endpoint is a separate serverless function
- **Cold Start Optimized**: Lightweight and fast startup
- **Scalable**: Each endpoint scales independently
- **Same Functionality**: All actuator features are available
- **Type Safe**: Full TypeScript support

## Migration from Express

If you're migrating from an Express application:

1. **Replace ActuatorMiddleware** with individual API routes
2. **Use individual collectors** (HealthChecker, MetricsCollector, etc.)
3. **Configure each endpoint** independently
4. **Add Vercel-specific metadata** to responses

## Example Files

- `api/actuator-serverless/index.ts` - Root endpoint with available links
- `api/actuator-serverless/health.ts` - Health check endpoint
- `api/actuator-serverless/metrics.ts` - Metrics endpoint
- `api/actuator-serverless/info.ts` - Info endpoint
- `api/actuator-serverless/env.ts` - Environment endpoint 
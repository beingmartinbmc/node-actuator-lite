# Node Actuator Lite

[![npm version](https://badge.fury.io/js/node-actuator-lite.svg)](https://badge.fury.io/js/node-actuator-lite)
[![npm downloads](https://img.shields.io/npm/dm/node-actuator-lite.svg)](https://www.npmjs.com/package/node-actuator-lite)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/beingmartinbmc/node-actuator-lite/workflows/CI/badge.svg)](https://github.com/beingmartinbmc/node-actuator-lite/actions)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/beingmartinbmc/node-actuator-lite)

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

## 🔧 Node.js Version Compatibility

### Supported Versions

Node Actuator Lite is tested and compatible with the following Node.js versions:

| Node.js Version | Status | Notes |
|----------------|--------|-------|
| **18.x** | ✅ **Recommended** | LTS version, fully supported |
| **20.x** | ✅ **Recommended** | LTS version, fully supported |
| **21.x** | ✅ **Supported** | Current version |
| **22.x** | ✅ **Supported** | Current version |
| **24.x** | ✅ **Supported** | Latest version (with platform-specific considerations) |
| **16.x** | ⚠️ **Deprecated** | End of life, not recommended |
| **14.x** | ❌ **Unsupported** | End of life, may not work |

### Platform Compatibility

The library is designed to work across different platforms with platform-specific optimizations:

#### **Windows**
- ✅ **Fully Supported**
- Disk space checks use Windows-specific fallback values
- Path handling optimized for Windows file system
- Test suite includes Windows-specific scenarios

#### **macOS**
- ✅ **Fully Supported**
- Native disk space checking via `df` command
- Unix-style path handling
- Optimized for macOS environments

#### **Linux**
- ✅ **Fully Supported**
- Native disk space checking via `df` command
- Unix-style path handling
- Optimized for server environments

### Version-Specific Considerations

#### **Node.js 24.x (Latest)**
- ✅ **Fully compatible**
- Platform-specific tests ensure cross-platform reliability
- May show different behavior for disk space checks on Windows vs Unix
- Recommended for new projects

#### **Node.js 20.x (LTS)**
- ✅ **Recommended for production**
- Most stable and widely tested
- Excellent compatibility across all platforms
- Long-term support until April 2026

#### **Node.js 18.x (LTS)**
- ✅ **Recommended for production**
- Very stable and well-tested
- Excellent compatibility across all platforms
- Long-term support until April 2025

### Troubleshooting Version Issues

If you encounter issues with specific Node.js versions:

1. **Check your Node.js version**:
   ```bash
   node --version
   ```

2. **Update to a supported version**:
   ```bash
   # Using nvm (Node Version Manager)
   nvm install 20
   nvm use 20
   
   # Or download from nodejs.org
   ```

3. **Clear npm cache**:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Run tests with isolation**:
   ```bash
   npm test -- --runInBand --detectOpenHandles
   ```

### Development Environment

For development, we recommend:
- **Node.js 20.x** (LTS) for maximum stability
- **npm 9.x** or **yarn 1.22.x** for package management
- **TypeScript 5.x** for type safety

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
  envOptions?: {                    // Environment variable masking configuration
    maskPatterns?: string[];        // Patterns to match for masking (e.g., ['PASSWORD', 'SECRET'])
    maskCustomVariables?: string[]; // Specific variable names to mask
    maskValue?: string;             // Value to show instead of actual value (default: '[HIDDEN]')
    showMaskedCount?: boolean;      // Show count of masked variables (default: true)
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

## 🚀 Vercel Integration

### Step-by-Step Setup

**1. Install the package:**
```bash
npm install node-actuator-lite
```

**2. Create the API route file:**
Create `api/actuator/[...path].js` in your Vercel project:

```javascript
import { LightweightActuator } from 'node-actuator-lite';

const actuator = new LightweightActuator({
  serverless: true, // ⚠️ CRITICAL: Enable serverless mode
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true,
  enableInfo: true,
  enableEnv: true,
  enableThreadDump: true,
  enableHeapDump: true,
  customHealthChecks: [
    {
      name: 'database', // ✅ Use named health checks
      check: async () => {
        // Your database health check
        return { status: 'UP', details: { /* your details */ } };
      }
    }
  ],
  customMetrics: [
    { name: 'app_requests_total', help: 'Total requests', type: 'counter' }
  ]
});

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await actuator.start();
    
    // ⚠️ CRITICAL: Vercel uses '...path' not 'path'
    const path = req.query['...path'];
    const pathString = Array.isArray(path) ? path.join('/') : path || '';
    
    switch (pathString) {
      case 'health':
        const health = await actuator.getHealth();
        return res.status(200).json(health);
      case 'metrics':
        const metrics = await actuator.getMetrics();
        return res.status(200).json(metrics);
      case 'prometheus':
        const prometheus = await actuator.getPrometheusMetrics();
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(prometheus);
      case 'info':
        const info = await actuator.getInfo();
        return res.status(200).json(info);
      case 'env':
        const env = await actuator.getEnvironment();
        return res.status(200).json(env);
      case 'threaddump':
        const threadDump = actuator.getThreadDump();
        return res.status(200).json(threadDump);
      case 'heapdump':
        if (req.method === 'POST') {
          const heapDump = await actuator.getHeapDump();
          return res.status(200).json(heapDump);
        }
        return res.status(405).json({ error: 'Method not allowed' });
      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

### Key Points for Vercel

✅ **Use `serverless: true`** - This prevents the library from starting its own HTTP server  
✅ **Use `req.query['...path']`** - Vercel passes dynamic routes as `...path`, not `path`  
✅ **Use named health checks** - Instead of generic "custom-0", use descriptive names  
✅ **Handle CORS** - Add proper CORS headers for web access  
✅ **Use direct methods** - `getHealth()`, `getMetrics()`, etc. (available in v1.2.0+)  

### Available Endpoints

- `GET /api/actuator/health` - Application health status
- `GET /api/actuator/metrics` - Application metrics (JSON)
- `GET /api/actuator/prometheus` - Prometheus metrics format
- `GET /api/actuator/info` - Application information
- `GET /api/actuator/env` - Environment variables
- `GET /api/actuator/threaddump` - Thread dump information
- `POST /api/actuator/heapdump` - Generate heap dump

### Common Issues

- **404 errors**: Make sure you're using `req.query['...path']` not `req.query.path`
- **Serverless errors**: Ensure `serverless: true` is set
- **Method errors**: Heapdump requires POST method

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

## 🔒 Environment Variable Masking

Protect sensitive environment variables from being exposed in the `/env` endpoint:

### Default Masking

By default, the following patterns are automatically masked:
- `PASSWORD`, `SECRET`, `KEY`, `TOKEN`, `AUTH`, `CREDENTIAL`, `PRIVATE`, `SIGNATURE`
- `API_KEY`, `DATABASE_URL`, `REDIS_URL`, `MONGODB_URI`, `JWT_SECRET`, `SESSION_SECRET`

### Custom Configuration

```typescript
const actuator = new LightweightActuator({
  envOptions: {
    // Custom patterns to match
    maskPatterns: ['CUSTOM', 'SPECIAL', 'SENSITIVE'],
    
    // Specific variables to mask
    maskCustomVariables: ['MY_SPECIFIC_VAR', 'ANOTHER_SECRET'],
    
    // Custom mask value
    maskValue: '🔒 HIDDEN 🔒',
    
    // Show masking statistics
    showMaskedCount: true
  }
});
```

### Examples

```typescript
// Basic masking
process.env['DATABASE_PASSWORD'] = 'secret123';
process.env['API_KEY'] = 'sk-123456789';

// Result: Both will show as '[HIDDEN]'

// Custom masking
const actuator = new LightweightActuator({
  envOptions: {
    maskCustomVariables: ['MY_SPECIAL_VAR'],
    maskValue: '***SECRET***'
  }
});

process.env['MY_SPECIAL_VAR'] = 'sensitive-data';
// Result: Will show as '***SECRET***'
```

### Utility Methods

```typescript
// Add patterns dynamically
actuator.envCollector.addMaskPattern('NEW_PATTERN');

// Add specific variables
actuator.envCollector.addCustomMaskVariable('SPECIFIC_VAR');

// Remove patterns
actuator.envCollector.removeMaskPattern('PASSWORD');

// Get current configuration
const patterns = actuator.envCollector.getMaskPatterns();
const customVars = actuator.envCollector.getCustomMaskVariables();
```

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

**4. Platform-specific test failures**
```bash
# ❌ Test failures on Windows with Node.js 24.x
# This was a known issue that has been resolved in v1.2.4+

# ✅ Solution: Update to latest version
npm update node-actuator-lite

# ✅ For development: Use platform-specific tests
npm test -- --runInBand --detectOpenHandles
```

**5. Node.js version compatibility issues**
```bash
# ❌ Using unsupported Node.js version
node --version  # Shows 14.x or 16.x

# ✅ Update to supported version
nvm install 20
nvm use 20

# ✅ Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
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
- Cross-platform compatibility with Windows, macOS, and Linux support
- Platform-specific test coverage for reliable deployment across environments

# Node Actuator Lite

A lightweight, production-ready monitoring and management library for Node.js applications, inspired by Spring Boot Actuator. This library provides comprehensive health checks, metrics collection, observability tools, and management endpoints to help you monitor and manage your Node.js applications in production environments.

## 🎯 What is Node Actuator Lite?

Node Actuator Lite is a monitoring and management library that provides:

- **Health Monitoring**: Real-time health checks for your application and its dependencies
- **Metrics Collection**: Built-in metrics with Prometheus support
- **Observability Tools**: Thread dumps, heap dumps, and environment information
- **Management Endpoints**: RESTful endpoints for application management
- **Resilient Design**: Configurable retry logic and error handling
- **Production Ready**: Designed for production environments with proper logging and error handling

## 🚀 Key Features

### Health Monitoring
- **Built-in Health Checks**: Database, disk space, process information
- **Custom Health Indicators**: Add your own health checks
- **External Service Monitoring**: Monitor third-party services and APIs
- **Critical vs Non-Critical**: Configure which services are critical to your application

### Metrics & Monitoring
- **Prometheus Integration**: Native Prometheus metrics format
- **Custom Metrics**: Add application-specific metrics
- **Performance Monitoring**: Request counts, response times, and system metrics
- **Real-time Collection**: Live metrics collection and reporting

### Observability
- **Thread Dumps**: Debug application performance issues
- **Heap Dumps**: Memory analysis and leak detection
- **Environment Information**: Runtime configuration and system details
- **Configuration Properties**: View and manage application settings

### Management & Operations
- **RESTful Endpoints**: Standard HTTP endpoints for all operations
- **Graceful Shutdown**: Proper cleanup and resource management
- **Dynamic Configuration**: Runtime health indicator and metric management
- **Error Handling**: Comprehensive error handling with retry logic

## 📦 Installation

```bash
npm install node-actuator-lite
```

## 🔨 Building the Project

### Prerequisites
- Node.js v14 or higher
- npm or yarn package manager

### Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/beingmartinbmc/node-actuator-lite.git
cd node-actuator-lite
```

2. **Install dependencies**
```bash
npm install
```

3. **Build the project**
```bash
npm run build
```

4. **Run tests**
```bash
npm test
```

5. **Run linting**
```bash
npm run lint
```

### Build Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run clean` - Clean build artifacts

### Project Structure

```
node-actuator-lite/
├── src/                    # Source code
│   ├── core/              # Core actuator functionality
│   ├── health/            # Health check implementations
│   ├── metrics/           # Metrics collection
│   ├── info/              # Application info collection
│   ├── env/               # Environment collection
│   └── utils/             # Utility functions
├── tests/                 # Test files
├── examples/              # Example applications
├── dist/                  # Compiled JavaScript (after build)
└── package.json           # Project configuration
```

## 🔧 Dependencies

This library uses the following key dependencies:

### Core Dependencies
- **Express.js**: Web framework for HTTP endpoints
- **Prometheus Client**: Metrics collection and Prometheus format support
- **Pino**: High-performance logging
- **Node.js Built-ins**: File system, process, and system information

### Optional Dependencies
- **v8-profiler-next**: For heap dump generation (optional)
- **Node.js v14+**: For modern JavaScript features and performance

## 🛠️ Quick Start

### Standalone Mode (Traditional Servers)

```typescript
import { Actuator, ActuatorOptions } from 'node-actuator-lite';

// Configure the actuator
const actuatorOptions: ActuatorOptions = {
  port: 0, // Use dynamic port
  basePath: '/actuator',
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true,
  enableInfo: true,
  enableEnv: true,
  enableThreadDump: true,
  enableHeapDump: true,
  retryOptions: {
    maxRetries: 3,
    retryDelay: 100,
    exponentialBackoff: true
  }
};

// Create and start the actuator
const actuator = new Actuator(actuatorOptions);
await actuator.start();

console.log(`Actuator running on port ${actuator.getPort()}`);
```

### Integration Mode (Serverless/Vercel)

```typescript
import express from 'express';
import { ActuatorMiddleware, ActuatorMiddlewareOptions } from 'node-actuator-lite';

const app = express();

// Configure everything upfront - serverless-friendly!
const actuatorOptions: ActuatorMiddlewareOptions = {
  basePath: '/actuator',
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true,
  enableInfo: true,
  enableEnv: true,
  enableThreadDump: true,
  enableHeapDump: false, // Disable in serverless
  // Serverless-friendly health checks configuration
  healthChecks: [
    {
      name: 'database',
      check: async () => ({ status: 'UP', details: { connected: true } }),
      enabled: true,
      critical: true
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
  retryOptions: {
    maxRetries: 3,
    retryDelay: 100,
    exponentialBackoff: true
  }
};

// Create actuator middleware (everything configured upfront!)
const actuatorMiddleware = new ActuatorMiddleware(actuatorOptions);

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

### Health Monitoring

```typescript
// Add custom health indicators
actuator.addHealthIndicator('custom-service', async () => {
  // Your health check logic
  return {
    status: 'UP',
    details: { responseTime: 45, version: '1.0.0' }
  };
});

// Add external service monitoring
actuator.addExternalServiceHealthCheck('payment-api', async () => {
  const response = await fetch('https://api.payments.com/health');
  return {
    status: response.ok ? 'UP' : 'DOWN',
    details: { responseTime: response.headers.get('x-response-time') }
  };
}, { critical: true });

// Add database health check
actuator.addDatabaseHealthCheck('main-db', async () => {
  // Database connection check
  return { status: 'UP', details: { connections: 10 } };
});
```

### Custom Metrics

```typescript
// Add custom Prometheus metrics
const requestCounter = actuator.addCustomMetric(
  'http_requests_total',
  'Total number of HTTP requests',
  'counter',
  { labelNames: ['method', 'endpoint', 'status'] }
);

const responseTimeHistogram = actuator.addCustomMetric(
  'http_request_duration_seconds',
  'HTTP request duration in seconds',
  'histogram',
  { labelNames: ['method', 'endpoint'] }
);

// Use the metrics in your application
requestCounter.inc({ method: 'GET', endpoint: '/api/users', status: '200' });
responseTimeHistogram.observe({ method: 'GET', endpoint: '/api/users' }, 0.15);
```

## 🔄 Deployment Modes

Node Actuator Lite supports two deployment modes to accommodate different hosting environments:

### Standalone Mode (`Actuator`)

**Best for**: Traditional servers, Docker containers, Kubernetes deployments

- Creates its own Express server
- Runs on a separate port
- Independent of your main application
- Similar to how you might run a separate monitoring service

```typescript
const actuator = new Actuator(options);
await actuator.start(); // Starts on separate port
```

### Integration Mode (`ActuatorMiddleware`)

**Best for**: Serverless platforms (Vercel, AWS Lambda), Express applications

- Integrates with your existing Express application
- Uses the same port as your main app
- Follows Spring Boot Actuator pattern
- No additional server overhead

```typescript
const actuatorMiddleware = new ActuatorMiddleware(options);
app.use(actuatorMiddleware.getRouter()); // Integrates with existing app
```

### Mode Comparison

| Feature | Standalone (`Actuator`) | Integration (`ActuatorMiddleware`) |
|---------|------------------------|-----------------------------------|
| Server | Creates own Express server | Uses existing Express app |
| Port | Separate port | Same port as main app |
| Deployment | Traditional servers, Docker, K8s | Serverless, Vercel, Express apps |
| Usage | `actuator.start()` | `app.use(actuatorMiddleware.getRouter())` |
| Configuration | Runtime API calls | All upfront in constructor |
| API Design | Instance methods | Constructor-only configuration |

### Serverless Considerations

When using `ActuatorMiddleware` in serverless environments:

1. **Disable Heap Dumps**: Set `enableHeapDump: false` (not relevant in serverless)
2. **Disable Disk Space Checks**: Set `healthOptions.includeDiskSpace: false`
3. **Configure Everything Upfront**: Use constructor options instead of runtime API calls
4. **Use Environment Variables**: Configure endpoints using environment variables for different deployment stages
5. **Keep Health Checks Lightweight**: Avoid cold start penalties

## 📊 Available Endpoints

Once started, the actuator provides the following endpoints:

### Health & Monitoring
- `GET /actuator/health` - Application health status
- `GET /actuator/metrics` - Application metrics (JSON format)
- `GET /actuator/prometheus` - Prometheus metrics format

### Information & Configuration
- `GET /actuator/info` - Application information
- `GET /actuator/env` - Environment variables
- `GET /actuator/configprops` - Configuration properties
- `GET /actuator/modules` - Application modules and beans

### Debugging & Analysis
- `GET /actuator/threaddump` - Thread dump for debugging
- `POST /actuator/heapdump` - Generate heap dump
- `GET /actuator/heapdump/download` - Download heap dump files
- `GET /actuator/heapdump/stats` - Heap dump statistics

### Management
- `GET /actuator/mappings` - Route mappings
- `GET /actuator` - Root endpoint with available links

## ⚙️ Configuration Options

```typescript
interface ActuatorOptions {
  port?: number;                    // Port number (0 for dynamic)
  basePath?: string;                // Base path for endpoints
  enableHealth?: boolean;           // Enable health endpoint
  enableMetrics?: boolean;          // Enable metrics endpoint
  enablePrometheus?: boolean;       // Enable Prometheus metrics
  enableInfo?: boolean;             // Enable info endpoint
  enableEnv?: boolean;              // Enable environment endpoint
  enableThreadDump?: boolean;       // Enable thread dump
  enableHeapDump?: boolean;         // Enable heap dump
  heapDumpOptions?: {               // Heap dump configuration
    outputDir?: string;
    filename?: string;
    includeTimestamp?: boolean;
    compress?: boolean;
    maxDepth?: number;
  };
  retryOptions?: {                  // Retry configuration
    maxRetries?: number;            // Max retry attempts (default: 3)
    retryDelay?: number;            // Base delay in ms (default: 100)
    exponentialBackoff?: boolean;   // Use exponential backoff (default: true)
  };
  healthOptions?: {                 // Health check configuration
    includeDiskSpace?: boolean;
    includeProcess?: boolean;
    diskSpaceThreshold?: number;
    healthCheckTimeout?: number;
  };
  customHealthChecks?: Array<() => Promise<{ status: string; details?: any }>>;
  customMetrics?: Array<{ name: string; help: string; type: 'counter' | 'gauge' | 'histogram' }>;
  customBeans?: Record<string, any>;
  customConfigProps?: Record<string, any>;
}
```

## 🔄 Retry Configuration

The actuator includes built-in retry logic for resilient endpoint handling:

```typescript
retryOptions: {
  maxRetries: 3,            // Maximum retry attempts
  retryDelay: 100,          // Base delay between retries (ms)
  exponentialBackoff: true  // Use exponential backoff
}
```

**Retry Behavior Example:**
- Attempt 1: Immediate
- Attempt 2: Wait 100ms
- Attempt 3: Wait 200ms (if exponential backoff enabled)
- Attempt 4: Wait 400ms (if exponential backoff enabled)

## 🧪 Testing

The library includes comprehensive integration tests that cover:

- **Business Logic Integration**: User management, email services, and statistics
- **Health Monitoring**: Custom health indicators, external service checks, and failure scenarios
- **Metrics Collection**: Prometheus metrics, custom metrics, and performance monitoring
- **Error Handling**: Database failures, email service failures, and graceful degradation
- **Performance Testing**: Concurrent requests, load testing, and response time validation
- **Dynamic Configuration**: Runtime health indicator and metric management
- **Observability**: Thread dumps, heap dumps, and comprehensive monitoring data
- **Retry Logic**: Configurable retry mechanisms for resilient endpoint handling
- **External Service Health Checks**: Monitoring of third-party services with configurable criticality

Run the tests with:

```bash
npm test
```

The test suite includes 21 comprehensive integration tests that validate all actuator functionality.

## 📈 Production Usage

### Docker Integration

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Kubernetes Health Checks

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
      - name: app
        image: my-app:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /actuator/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /actuator/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Prometheus Scraping

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'my-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/actuator/prometheus'
    scrape_interval: 15s
```

## 🤝 Contributing

We welcome contributions to Node Actuator Lite! Here's how you can help:

### Getting Started

1. **Fork the repository**
   - Visit [https://github.com/beingmartinbmc/node-actuator-lite](https://github.com/beingmartinbmc/node-actuator-lite)
   - Click the "Fork" button to create your own copy

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/node-actuator-lite.git
   cd node-actuator-lite
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

4. **Make your changes**
   - Write your code
   - Add tests for new functionality
   - Ensure all tests pass: `npm test`
   - Run linting: `npm run lint`

5. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

7. **Create a Pull Request**
   - Go to your fork on GitHub
   - Click "New Pull Request"
   - Select the main branch as the base
   - Describe your changes clearly

### Development Guidelines

- **Code Style**: Follow the existing code style and run `npm run lint:fix`
- **Testing**: Add tests for new features and ensure all tests pass
- **Documentation**: Update documentation for any new features or changes
- **TypeScript**: Use TypeScript for all new code
- **Commits**: Use clear, descriptive commit messages

### Reporting Issues

- Use the [GitHub Issues](https://github.com/beingmartinbmc/node-actuator-lite/issues) page
- Include a clear description of the problem
- Provide steps to reproduce the issue
- Include your Node.js version and operating system

### Questions or Discussions

- Open a [GitHub Discussion](https://github.com/beingmartinbmc/node-actuator-lite/discussions)
- Ask questions about usage, features, or development

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Spring Boot Actuator
- Built with Express.js and Prometheus client
- Uses Pino for high-performance logging
- Designed for production Node.js applications

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/beingmartinbmc/node-actuator-lite/issues)
- **Documentation**: [USAGE.md](USAGE.md) for detailed usage examples
- **Examples**: Check the `examples/` directory for complete application examples

---

**Node Actuator Lite** - Production-ready monitoring and management for Node.js applications 🚀 
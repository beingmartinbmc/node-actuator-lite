# Node Actuator Lite - Examples

This directory contains examples and integration tests demonstrating how to use the Node Actuator Lite framework in real-world applications.

## Sample Application

The `sample-app.ts` file demonstrates a complete Node.js application that integrates the actuator framework with business logic. It includes:

### Features Demonstrated

1. **Business Services**: User management, email service, and database service
2. **Custom Health Checks**: Database and email service health monitoring
3. **Custom Metrics**: Request counters, response times, and business metrics
4. **Configuration Management**: Application settings and feature flags
5. **Error Handling**: Graceful handling of service failures
6. **Monitoring**: Comprehensive observability endpoints

### Business Logic Components

- **UserService**: Manages user creation and retrieval
- **EmailService**: Handles email sending with failure simulation
- **DatabaseService**: Simulates database operations with connection issues

### Actuator Integration

The sample application shows how to:

- Configure custom health indicators for business services
- Define custom Prometheus metrics for business operations
- Register application beans and configuration properties
- Handle graceful shutdown and cleanup
- Monitor application performance and health

## Running the Sample Application

### Prerequisites

```bash
npm install
npm run build
```

### Start the Application

```bash
# Run the sample application
npx ts-node examples/sample-app.ts
```

The application will start on two ports:
- **Port 3000**: Main application endpoints
- **Port 3001**: Actuator monitoring endpoints

### Available Endpoints

#### Business Endpoints (Port 3000)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `POST /api/email` - Send email
- `GET /api/stats` - Get application statistics

#### Actuator Endpoints (Port 3001)
- `GET /actuator/health` - Health check
- `GET /actuator/metrics` - Application metrics
- `GET /actuator/prometheus` - Prometheus metrics
- `GET /actuator/info` - Application info
- `GET /actuator/env` - Environment variables
- `GET /actuator/configprops` - Configuration properties
- `GET /actuator/beans` - Application beans
- `GET /actuator/mappings` - Route mappings
- `GET /actuator/threaddump` - Thread dump
- `POST /actuator/heapdump` - Generate heap dump

## Integration Tests

The integration tests demonstrate comprehensive testing of the actuator framework in a real application context.

### Running Integration Tests

```bash
# Run all integration tests
npm test -- tests/Integration.test.ts
npm test -- tests/SampleAppIntegration.test.ts

# Run with coverage
npm run test:coverage
```

### Test Categories

1. **Basic Functionality**: Server startup, endpoint availability
2. **Health Monitoring**: Custom health indicators, failure scenarios
3. **Metrics Collection**: Custom metrics, Prometheus integration
4. **Configuration**: Dynamic configuration, runtime changes
5. **Error Handling**: Graceful failure handling, resilience
6. **Performance**: Load testing, concurrent requests
7. **Monitoring**: Comprehensive observability testing

## Key Integration Patterns

### 1. Custom Health Indicators

```typescript
const actuatorOptions: ActuatorOptions = {
  healthOptions: {
    customIndicators: [
      {
        name: 'database',
        check: async () => await databaseService.healthCheck(),
        enabled: true,
        critical: true
      }
    ]
  }
};
```

### 2. Custom Metrics

```typescript
const actuatorOptions: ActuatorOptions = {
  customMetrics: [
    { name: 'user_requests_total', help: 'Total user requests', type: 'counter' },
    { name: 'database_response_time', help: 'DB response time', type: 'histogram' }
  ]
};

// Usage in business logic
const userRequestsCounter = actuator.getCustomMetric('user_requests_total');
userRequestsCounter.inc();
```

### 3. Runtime Configuration

```typescript
// Add health indicators at runtime
actuator.addHealthIndicator('new-service', healthCheckFunction);

// Add custom metrics at runtime
const newMetric = actuator.addCustomMetric('runtime_metric', 'Help text', 'counter');
```

### 4. Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  server.close(async () => {
    await actuator.shutdown();
    process.exit(0);
  });
});
```

## Monitoring and Observability

The sample application demonstrates comprehensive monitoring capabilities:

### Health Monitoring
- System health (disk space, process)
- Custom service health (database, email)
- Failure rate monitoring
- Response time tracking

### Metrics Collection
- Business metrics (user requests, emails sent)
- System metrics (CPU, memory, disk)
- Custom Prometheus metrics
- Histogram for response times

### Debugging Support
- Thread dumps for performance analysis
- Heap dumps for memory analysis
- Route mappings for API documentation
- Configuration inspection

## Best Practices Demonstrated

1. **Separation of Concerns**: Business logic separated from monitoring
2. **Error Handling**: Graceful degradation and failure reporting
3. **Performance Monitoring**: Response time tracking and load testing
4. **Configuration Management**: Centralized configuration with runtime updates
5. **Observability**: Comprehensive logging and metrics collection
6. **Resilience**: Health checks and failure recovery
7. **Testing**: Comprehensive integration testing

## Extending the Example

To extend this example for your own application:

1. **Replace Business Services**: Implement your actual business logic
2. **Add Custom Health Checks**: Monitor your external dependencies
3. **Define Custom Metrics**: Track your business KPIs
4. **Configure Monitoring**: Set up alerts and dashboards
5. **Add Authentication**: Secure actuator endpoints in production
6. **Implement Logging**: Add structured logging for better observability

This example provides a solid foundation for integrating the Node Actuator Lite framework into production applications. 
// Main entry point
export { NodeActuator } from './core/Actuator';

// Types
export type {
  ActuatorOptions,
  HealthConfig,
  HealthIndicatorRegistration,
  HealthIndicatorResult,
  HealthStatus,
  HealthResponse,
  HealthComponentResponse,
  ShowDetails,
  EnvConfig,
  EnvResponse,
  EnvPropertySource,
  HeapDumpConfig,
  HeapDumpResponse,
  PrometheusConfig,
  CustomMetricDefinition,
  ThreadDumpResponse,
  DiscoveryResponse,
  DiscoveryLink,
} from './core/types';

// Collectors (for advanced / direct usage)
export { HealthCollector } from './collectors/HealthCollector';
export { EnvironmentCollector } from './collectors/EnvironmentCollector';
export { PrometheusCollector } from './collectors/PrometheusCollector';
export { ThreadDumpCollector } from './collectors/ThreadDumpCollector';
export { HeapDumpCollector } from './collectors/HeapDumpCollector';

// Middleware
export { actuatorMiddleware } from './middleware/express';
export type { ActuatorMiddlewareResult } from './middleware/express';
export { actuatorPlugin } from './middleware/fastify';
export type { ActuatorPluginOptions } from './middleware/fastify';

// Logger
export { logger, LOG_LEVELS } from './utils/logger';
export type { LogLevel } from './utils/logger';

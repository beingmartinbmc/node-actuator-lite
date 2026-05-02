import { NodeActuator } from './core/Actuator';
import type { CustomEndpointContext, CustomEndpointRegistration } from './core/types';

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
  InfoConfig,
  InfoResponse,
  MetricsConfig,
  MetricsResponse,
  PrometheusConfig,
  CustomMetricDefinition,
  ThreadDumpResponse,
  DiscoveryResponse,
  DiscoveryLink,
  CustomEndpointRegistration,
  CustomEndpointContext,
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

const defaultActuator = new NodeActuator({ serverless: true });

export function registerEndpoint(endpoint: CustomEndpointRegistration): void;
export function registerEndpoint(
  id: string,
  handler: CustomEndpointRegistration['handler'],
  options?: Omit<CustomEndpointRegistration, 'id' | 'handler'>,
): void;
export function registerEndpoint(
  endpointOrId: CustomEndpointRegistration | string,
  handler?: CustomEndpointRegistration['handler'],
  options: Omit<CustomEndpointRegistration, 'id' | 'handler'> = {},
): void {
  if (typeof endpointOrId === 'string') {
    if (!handler) throw new Error('registerEndpoint requires a handler');
    NodeActuator.registerGlobalEndpoint({ id: endpointOrId, handler, ...options });
    return;
  }
  NodeActuator.registerGlobalEndpoint(endpointOrId);
}

export async function invokeEndpoint(path: string, context?: CustomEndpointContext): Promise<any> {
  return defaultActuator.invokeEndpoint(path, context);
}

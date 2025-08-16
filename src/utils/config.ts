import logger from './logger';

export interface ValidatedActuatorOptions {
  port: number;
  basePath: string;
  enableHealth: boolean;
  enableMetrics: boolean;
  enableInfo: boolean;
  enableEnv: boolean;
  enablePrometheus: boolean;
  enableMappings: boolean;
  enableBeans: boolean;
  enableConfigProps: boolean;
  enableThreadDump: boolean;
  enableHeapDump: boolean;
  heapDumpOptions?: {
    outputDir?: string;
    filename?: string;
    includeTimestamp?: boolean;
    compress?: boolean;
    maxDepth?: number;
  };
  customHealthChecks: Array<() => Promise<{ status: string; details?: any }>>;
  customMetrics: Array<{ name: string; help: string; type: 'counter' | 'gauge' | 'histogram' }>;
  customBeans: Record<string, any>;
  customConfigProps: Record<string, any>;
  healthOptions?: {
    includeDiskSpace?: boolean;
    includeProcess?: boolean;
    diskSpaceThreshold?: number;
    diskSpacePath?: string;
    healthCheckTimeout?: number; // Timeout for health checks in milliseconds (default: 5000)
    customIndicators?: Array<{
      name: string;
      check: () => Promise<{ status: string; details?: any }>;
      enabled?: boolean;
      critical?: boolean;
    }>;
  };
  retryOptions?: {
    maxRetries?: number; // Maximum number of retry attempts (default: 3)
    retryDelay?: number; // Base delay between retries in milliseconds (default: 100)
    exponentialBackoff?: boolean; // Whether to use exponential backoff (default: true)
  };
}

export function validateConfig(options: any): ValidatedActuatorOptions {
  const errors: string[] = [];

  // Validate port
  if (options.port !== undefined) {
    if (typeof options.port !== 'number' || options.port < 0 || options.port > 65535) {
      errors.push('Port must be a number between 0 and 65535');
    }
  }

  // Validate basePath
  if (options.basePath !== undefined) {
    if (typeof options.basePath !== 'string' || !options.basePath.startsWith('/')) {
      errors.push('Base path must be a string starting with /');
    }
  }

  // Validate boolean flags
  const booleanFields = [
    'enableHealth', 'enableMetrics', 'enableInfo', 'enableEnv',
    'enablePrometheus', 'enableMappings', 'enableBeans', 'enableConfigProps',
    'enableThreadDump', 'enableHeapDump'
  ];

  booleanFields.forEach(field => {
    if (options[field] !== undefined && typeof options[field] !== 'boolean') {
      errors.push(`${field} must be a boolean`);
    }
  });

  // Validate arrays
  if (options.customHealthChecks !== undefined && !Array.isArray(options.customHealthChecks)) {
    errors.push('customHealthChecks must be an array');
  }

  if (options.customMetrics !== undefined && !Array.isArray(options.customMetrics)) {
    errors.push('customMetrics must be an array');
  }

  // Validate objects
  if (options.customBeans !== undefined && typeof options.customBeans !== 'object') {
    errors.push('customBeans must be an object');
  }

  if (options.customConfigProps !== undefined && typeof options.customConfigProps !== 'object') {
    errors.push('customConfigProps must be an object');
  }

  // Validate health options
  if (options.healthOptions !== undefined) {
    if (typeof options.healthOptions !== 'object') {
      errors.push('healthOptions must be an object');
    } else {
      if (options.healthOptions.diskSpaceThreshold !== undefined) {
        if (typeof options.healthOptions.diskSpaceThreshold !== 'number' || options.healthOptions.diskSpaceThreshold < 0) {
          errors.push('diskSpaceThreshold must be a positive number');
        }
      }
      
      if (options.healthOptions.diskSpacePath !== undefined && typeof options.healthOptions.diskSpacePath !== 'string') {
        errors.push('diskSpacePath must be a string');
      }
      
      if (options.healthOptions.healthCheckTimeout !== undefined) {
        if (typeof options.healthOptions.healthCheckTimeout !== 'number' || options.healthOptions.healthCheckTimeout < 100) {
          errors.push('healthCheckTimeout must be a number greater than or equal to 100ms');
        }
      }
    }
  }

  // Validate retry options
  if (options.retryOptions !== undefined) {
    if (typeof options.retryOptions !== 'object') {
      errors.push('retryOptions must be an object');
    } else {
      if (options.retryOptions.maxRetries !== undefined) {
        if (typeof options.retryOptions.maxRetries !== 'number' || options.retryOptions.maxRetries < 0 || options.retryOptions.maxRetries > 10) {
          errors.push('maxRetries must be a number between 0 and 10');
        }
      }
      
      if (options.retryOptions.retryDelay !== undefined) {
        if (typeof options.retryOptions.retryDelay !== 'number' || options.retryOptions.retryDelay < 10 || options.retryOptions.retryDelay > 10000) {
          errors.push('retryDelay must be a number between 10 and 10000ms');
        }
      }
      
      if (options.retryOptions.exponentialBackoff !== undefined && typeof options.retryOptions.exponentialBackoff !== 'boolean') {
        errors.push('exponentialBackoff must be a boolean');
      }
    }
  }

  if (errors.length > 0) {
    const errorMessage = `Configuration validation failed:\n${errors.join('\n')}`;
    logger.error('Configuration validation failed', { errors });
    throw new Error(errorMessage);
  }

  logger.info('Configuration validation passed');
  return options as ValidatedActuatorOptions;
} 
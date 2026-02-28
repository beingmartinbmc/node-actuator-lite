// ============================================================================
// Configuration Types
// ============================================================================

export type HealthStatus = 'UP' | 'DOWN' | 'OUT_OF_SERVICE' | 'UNKNOWN';

export type ShowDetails = 'never' | 'always';

export interface ActuatorOptions {
  port?: number;
  basePath?: string;
  serverless?: boolean;

  health?: HealthConfig;
  env?: EnvConfig;
  threadDump?: { enabled?: boolean };
  heapDump?: HeapDumpConfig;
  prometheus?: PrometheusConfig;
}

export interface HealthConfig {
  enabled?: boolean;
  showDetails?: ShowDetails;
  timeout?: number;
  indicators?: {
    diskSpace?: { enabled?: boolean; threshold?: number; path?: string };
    process?: { enabled?: boolean };
  };
  groups?: Record<string, string[]>;
  custom?: HealthIndicatorRegistration[];
}

export interface HealthIndicatorRegistration {
  name: string;
  check: () => Promise<HealthIndicatorResult>;
  critical?: boolean;
}

export interface EnvConfig {
  enabled?: boolean;
  mask?: {
    patterns?: string[];
    additional?: string[];
    replacement?: string;
  };
}

export interface HeapDumpConfig {
  enabled?: boolean;
  outputDir?: string;
}

export interface PrometheusConfig {
  enabled?: boolean;
  defaultMetrics?: boolean;
  prefix?: string;
  customMetrics?: CustomMetricDefinition[];
}

export interface CustomMetricDefinition {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels?: string[];
  buckets?: number[];
}

// ============================================================================
// Response Types
// ============================================================================

export interface HealthIndicatorResult {
  status: HealthStatus;
  details?: Record<string, any>;
}

export interface HealthComponentResponse {
  status: HealthStatus;
  details?: Record<string, any>;
}

export interface HealthResponse {
  status: HealthStatus;
  components?: Record<string, HealthComponentResponse>;
}

export interface EnvPropertySource {
  name: string;
  properties: Record<string, { value: string }>;
}

export interface EnvResponse {
  activeProfiles: string[];
  propertySources: EnvPropertySource[];
}

export interface ThreadDumpResponse {
  timestamp: string;
  pid: number;
  nodeVersion: string;
  platform: string;
  arch: string;
  uptime: number;
  mainThread: {
    name: string;
    state: string;
    cpuUsage: NodeJS.CpuUsage;
    stackTrace: string[];
  };
  eventLoop: {
    activeHandles: { count: number; types: string[] };
    activeRequests: { count: number; types: string[] };
  };
  workers: Array<{
    threadId: number;
    name: string;
    state: string;
  }>;
  memory: NodeJS.MemoryUsage;
  resourceUsage: NodeJS.ResourceUsage | null;
  v8HeapStats: Record<string, any>;
  v8HeapSpaces: Record<string, any>[];
}

export interface HeapDumpResponse {
  timestamp: string;
  pid: number;
  filePath: string;
  fileSize: number;
  duration: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
}

export interface DiscoveryLink {
  href: string;
  templated?: boolean;
}

export interface DiscoveryResponse {
  _links: Record<string, DiscoveryLink>;
}

// ============================================================================
// Internal Types
// ============================================================================

export interface ResolvedActuatorOptions {
  port: number;
  basePath: string;
  serverless: boolean;

  health: Required<Pick<HealthConfig, 'enabled' | 'showDetails' | 'timeout'>> & {
    indicators: {
      diskSpace: { enabled: boolean; threshold: number; path: string };
      process: { enabled: boolean };
    };
    groups: Record<string, string[]>;
    custom: HealthIndicatorRegistration[];
  };

  env: {
    enabled: boolean;
    mask: {
      patterns: string[];
      additional: string[];
      replacement: string;
    };
  };

  threadDump: { enabled: boolean };

  heapDump: {
    enabled: boolean;
    outputDir: string;
  };

  prometheus: {
    enabled: boolean;
    defaultMetrics: boolean;
    prefix: string;
    customMetrics: CustomMetricDefinition[];
  };
}

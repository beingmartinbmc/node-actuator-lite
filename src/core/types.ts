// ============================================================================
// Configuration Types
// ============================================================================

export type HealthStatus = 'UP' | 'DOWN' | 'OUT_OF_SERVICE' | 'UNKNOWN';

export type ShowDetails = 'never' | 'always';

/**
 * Authorization callback. Receives a transport-agnostic request context and
 * must return `true` to allow the request or `false` to reject it with 401.
 * Applies to every actuator endpoint across the standalone server, the Express
 * middleware, and the Fastify plugin.
 */
export type AuthCallback = (ctx: {
  method: string;
  subPath: string;
  query: Record<string, string>;
  params: Record<string, string>;
  raw?: unknown;
}) => boolean | Promise<boolean>;

/** Minimal logger interface so a custom logger (pino/winston/…) can be injected. */
export interface ActuatorLogger {
  trace(msg: string, data?: unknown): void;
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
}

export interface ActuatorOptions {
  port?: number;
  basePath?: string;
  serverless?: boolean;

  /** Optional authorization callback applied to every endpoint. */
  auth?: AuthCallback;
  /** Optional custom logger. Defaults to the built-in JSON console logger. */
  logger?: ActuatorLogger;

  info?: InfoConfig;
  metrics?: MetricsConfig;
  health?: HealthConfig;
  env?: EnvConfig;
  threadDump?: { enabled?: boolean };
  heapDump?: HeapDumpConfig;
  prometheus?: PrometheusConfig;
  /** Built-in HTML dashboard served at `<basePath>/dashboard`. Enabled by default. */
  dashboard?: { enabled?: boolean };
  endpoints?: CustomEndpointRegistration[];
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
    /**
     * When set, only variables whose name is in this allowlist are exposed at
     * all. Everything else is omitted entirely (names included). Use this for
     * defence-in-depth when exposing /env in production.
     */
    allowlist?: string[];
  };
}

export interface HeapDumpConfig {
  enabled?: boolean;
  outputDir?: string;
  /**
   * Minimum interval (ms) between successive heap dumps. Additional requests
   * within this window are rejected to prevent event-loop-blocking DoS.
   * Defaults to 60000 (1 minute). Set to 0 to disable throttling.
   */
  minIntervalMs?: number;
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

export interface InfoConfig {
  enabled?: boolean;
  build?: Record<string, any>;
  contributors?: Array<{
    name: string;
    collect: () => Record<string, any> | Promise<Record<string, any>>;
  }>;
}

export interface MetricsConfig {
  enabled?: boolean;
}

export interface CustomEndpointRegistration {
  id: string;
  method?: 'GET' | 'POST';
  handler: (context?: CustomEndpointContext) => any | Promise<any>;
  contentType?: 'json' | 'text';
}

export interface CustomEndpointContext {
  method?: string;
  path?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  raw?: any;
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

export interface InfoResponse {
  build?: Record<string, any>;
  runtime: {
    nodeVersion: string;
    platform: string;
    arch: string;
    pid: number;
    cwd: string;
    uptime: number;
  };
  contributors?: Record<string, any>;
}

export interface MetricsResponse {
  process: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
  };
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
  auth: AuthCallback | undefined;

  info: {
    enabled: boolean;
    build: Record<string, any> | undefined;
    contributors: Array<{
      name: string;
      collect: () => Record<string, any> | Promise<Record<string, any>>;
    }>;
  };

  metrics: {
    enabled: boolean;
  };

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
      allowlist?: string[] | undefined;
    };
  };

  threadDump: { enabled: boolean };

  heapDump: {
    enabled: boolean;
    outputDir: string;
    minIntervalMs: number;
  };

  prometheus: {
    enabled: boolean;
    defaultMetrics: boolean;
    prefix: string;
    customMetrics: CustomMetricDefinition[];
  };

  dashboard: { enabled: boolean };

  endpoints: CustomEndpointRegistration[];
}

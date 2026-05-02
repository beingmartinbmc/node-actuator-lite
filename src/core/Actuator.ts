import { logger } from '../utils/logger';
import { ActuatorServer } from './Server';
import type { ParsedRequest, WrappedResponse } from './Server';
import { HealthCollector } from '../collectors/HealthCollector';
import { EnvironmentCollector, DEFAULT_MASK_PATTERNS } from '../collectors/EnvironmentCollector';
import { PrometheusCollector } from '../collectors/PrometheusCollector';
import { ThreadDumpCollector } from '../collectors/ThreadDumpCollector';
import { HeapDumpCollector } from '../collectors/HeapDumpCollector';
import type {
  ActuatorOptions,
  ResolvedActuatorOptions,
  DiscoveryResponse,
  HealthResponse,
  HealthComponentResponse,
  EnvResponse,
  ThreadDumpResponse,
  HeapDumpResponse,
  InfoResponse,
  MetricsResponse,
  CustomEndpointRegistration,
  CustomEndpointContext,
} from './types';

export class NodeActuator {
  private static globalEndpoints: Map<string, CustomEndpointRegistration> = new Map();
  private static instances: Set<NodeActuator> = new Set();
  private opts: ResolvedActuatorOptions;
  private server?: ActuatorServer;
  private customEndpoints: Map<string, CustomEndpointRegistration> = new Map();

  // Collectors — exposed as readonly for advanced usage
  readonly health: HealthCollector;
  readonly env: EnvironmentCollector;
  readonly prometheus: PrometheusCollector;
  readonly threadDump: ThreadDumpCollector;
  readonly heapDump: HeapDumpCollector;

  constructor(options: ActuatorOptions = {}) {
    this.opts = this.resolve(options);

    // Warn if running in a serverless env without serverless flag
    if (!this.opts.serverless) {
      const isServerless =
        process.env['VERCEL_ENV'] ||
        process.env['NETLIFY'] ||
        process.env['AWS_LAMBDA_FUNCTION_NAME'];
      if (isServerless) {
        logger.warn('Detected serverless environment — consider setting serverless: true');
      }
    }

    // Initialise collectors
    this.health = new HealthCollector(this.opts.health);
    this.env = new EnvironmentCollector(this.opts.env);
    this.prometheus = new PrometheusCollector(this.opts.prometheus);
    this.threadDump = new ThreadDumpCollector();
    this.heapDump = new HeapDumpCollector(this.opts.heapDump);
    NodeActuator.instances.add(this);
    for (const endpoint of NodeActuator.globalEndpoints.values()) {
      this.registerEndpoint(endpoint);
    }
    for (const endpoint of this.opts.endpoints) {
      this.registerEndpoint(endpoint);
    }

    // Initialise HTTP server (unless serverless)
    if (!this.opts.serverless) {
      this.server = new ActuatorServer(this.opts.port, this.opts.basePath);
      this.registerRoutes();
    }
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async start(): Promise<number> {
    if (this.opts.serverless) {
      logger.info('NodeActuator initialised in serverless mode');
      return 0;
    }
    const port = await this.server!.start();
    logger.info(`NodeActuator listening on port ${port}`);
    return port;
  }

  async stop(): Promise<void> {
    if (this.server) await this.server.stop();
    NodeActuator.instances.delete(this);
  }

  getPort(): number {
    return this.server?.getPort() ?? 0;
  }

  // ===========================================================================
  // Programmatic API (serverless-friendly)
  // ===========================================================================

  /** Discovery endpoint — lists enabled endpoints. */
  discovery(): DiscoveryResponse {
    const base = this.opts.serverless
      ? this.opts.basePath
      : `http://localhost:${this.getPort()}${this.opts.basePath}`;

    const links: DiscoveryResponse['_links'] = {
      self: { href: `${base}` },
    };

    if (this.opts.health.enabled) {
      links['health'] = { href: `${base}/health` };
      links['health-component'] = { href: `${base}/health/{component}`, templated: true };
      for (const g of Object.keys(this.opts.health.groups)) {
        links[`health-${g}`] = { href: `${base}/health/${g}` };
      }
    }
    if (this.opts.env.enabled) {
      links['env'] = { href: `${base}/env` };
      links['env-variable'] = { href: `${base}/env/{name}`, templated: true };
    }
    if (this.opts.threadDump.enabled) {
      links['threaddump'] = { href: `${base}/threaddump` };
    }
    if (this.opts.heapDump.enabled) {
      links['heapdump'] = { href: `${base}/heapdump` };
    }
    if (this.opts.prometheus.enabled) {
      links['prometheus'] = { href: `${base}/prometheus` };
    }
    if (this.opts.info.enabled) {
      links['info'] = { href: `${base}/info` };
    }
    if (this.opts.metrics.enabled) {
      links['metrics'] = { href: `${base}/metrics` };
    }
    for (const endpoint of this.customEndpoints.values()) {
      links[this.normalizeEndpointId(endpoint.id)] = {
        href: `${base}/${this.normalizeEndpointId(endpoint.id)}`,
      };
    }

    return { _links: links };
  }

  async getHealth(showDetails?: string): Promise<HealthResponse> {
    return this.health.collect(showDetails);
  }

  async getHealthComponent(name: string): Promise<HealthComponentResponse | null> {
    return this.health.component(name);
  }

  async getHealthGroup(group: string): Promise<HealthResponse | null> {
    return this.health.group(group);
  }

  getEnv(): EnvResponse {
    return this.env.collect();
  }

  getEnvVariable(name: string): { name: string; value: string } | null {
    return this.env.variable(name);
  }

  getThreadDump(): ThreadDumpResponse {
    return this.threadDump.collect();
  }

  async getHeapDump(): Promise<HeapDumpResponse> {
    return this.heapDump.collect();
  }

  async getPrometheus(): Promise<string> {
    return this.prometheus.collect();
  }

  getInfo(): InfoResponse {
    const response: InfoResponse = {
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        cwd: process.cwd(),
        uptime: process.uptime(),
      },
    };

    const build = this.opts.info.build ?? this.getPackageBuildInfo();
    if (build) response.build = build;
    return response;
  }

  async getInfoAsync(): Promise<InfoResponse> {
    const response = this.getInfo();
    const contributors: Record<string, any> = {};

    for (const contributor of this.opts.info.contributors) {
      contributors[contributor.name] = await contributor.collect();
    }

    if (Object.keys(contributors).length > 0) {
      response.contributors = contributors;
    }

    return response;
  }

  getMetrics(): MetricsResponse {
    return {
      process: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    };
  }

  registerEndpoint(endpoint: CustomEndpointRegistration): void {
    const normalized = this.normalizeEndpointId(endpoint.id);
    const registered = { ...endpoint, id: normalized, method: endpoint.method ?? 'GET' };
    this.customEndpoints.set(this.endpointKey(registered.method, normalized), registered);

    if (this.server) {
      this.registerCustomEndpointRoute(registered);
    }
  }

  async invokeEndpoint(path: string, context: CustomEndpointContext = {}): Promise<any> {
    const id = this.normalizeEndpointId(path);
    const method = (context.method ?? 'GET').toUpperCase() as 'GET' | 'POST';
    const endpoint = this.customEndpoints.get(this.endpointKey(method, id));
    if (!endpoint) return null;
    return endpoint.handler({ ...context, method, path: `/${id}` });
  }

  static registerGlobalEndpoint(endpoint: CustomEndpointRegistration): void {
    const normalized = NodeActuator.normalizeEndpointId(endpoint.id);
    const registered = { ...endpoint, id: normalized, method: endpoint.method ?? 'GET' };
    NodeActuator.globalEndpoints.set(NodeActuator.endpointKey(registered.method, normalized), registered);

    for (const instance of NodeActuator.instances) {
      instance.registerEndpoint(registered);
    }
  }

  // ===========================================================================
  // Route Registration
  // ===========================================================================

  private registerRoutes(): void {
    const srv = this.server!;

    // Discovery
    srv.get('/', (_req, res) => {
      res.json(this.discovery());
    });

    // Health
    if (this.opts.health.enabled) {
      srv.get('/health', async (req, res) => {
        const result = await this.health.collect(req.query['showDetails']);
        const code = result.status === 'UP' ? 200 : 503;
        res.status(code).json(result);
      });

      srv.get('/health/:component', async (req, res) => {
        const name = req.params['component']!;

        // Check if it's a group first
        const groupResult = await this.health.group(name);
        if (groupResult) {
          const code = groupResult.status === 'UP' ? 200 : 503;
          res.status(code).json(groupResult);
          return;
        }

        // Then individual component
        const comp = await this.health.component(name);
        if (!comp) {
          res.status(404).json({ error: `Health component '${name}' not found` });
          return;
        }
        const code = comp.status === 'UP' ? 200 : 503;
        res.status(code).json(comp);
      });
    }

    // Environment
    if (this.opts.env.enabled) {
      srv.get('/env', (_req, res) => {
        res.json(this.env.collect());
      });

      srv.get('/env/:name', (req, res) => {
        const result = this.env.variable(req.params['name']!);
        if (!result) {
          res.status(404).json({ error: `Variable '${req.params['name']}' not found` });
          return;
        }
        res.json(result);
      });
    }

    // Thread dump
    if (this.opts.threadDump.enabled) {
      srv.get('/threaddump', (_req, res) => {
        res.json(this.threadDump.collect());
      });
    }

    // Heap dump (POST — it's a heavy side-effect operation)
    if (this.opts.heapDump.enabled) {
      srv.post('/heapdump', async (_req, res) => {
        const result = await this.heapDump.collect();
        res.json(result);
      });
    }

    // Prometheus
    if (this.opts.prometheus.enabled) {
      srv.get('/prometheus', async (_req, res) => {
        const text = await this.prometheus.collect();
        res.text(text);
      });
    }

    if (this.opts.info.enabled) {
      srv.get('/info', async (_req, res) => {
        res.json(await this.getInfoAsync());
      });
    }

    if (this.opts.metrics.enabled) {
      srv.get('/metrics', (_req, res) => {
        res.json(this.getMetrics());
      });
    }

    for (const endpoint of this.customEndpoints.values()) {
      this.registerCustomEndpointRoute(endpoint);
    }
  }

  private registerCustomEndpointRoute(endpoint: CustomEndpointRegistration): void {
    const method = endpoint.method ?? 'GET';
    this.server!.route(method, `/${this.normalizeEndpointId(endpoint.id)}`, async (req, res) => {
      const result = await endpoint.handler(this.toEndpointContext(req));
      this.sendCustomEndpointResponse(endpoint, result, res);
    });
  }

  private toEndpointContext(req: ParsedRequest): CustomEndpointContext {
    return {
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      raw: req.raw,
    };
  }

  private sendCustomEndpointResponse(
    endpoint: CustomEndpointRegistration,
    result: any,
    res: WrappedResponse,
  ): void {
    if (endpoint.contentType === 'text') {
      res.text(String(result));
      return;
    }
    res.json(result);
  }

  // ===========================================================================
  // Config Resolution
  // ===========================================================================

  private resolve(o: ActuatorOptions): ResolvedActuatorOptions {
    return {
      port: o.port ?? 0,
      basePath: o.basePath ?? '/actuator',
      serverless: o.serverless ?? false,

      info: {
        enabled: o.info?.enabled ?? true,
        build: o.info?.build,
        contributors: o.info?.contributors ?? [],
      },

      metrics: {
        enabled: o.metrics?.enabled ?? true,
      },

      health: {
        enabled: o.health?.enabled ?? true,
        showDetails: o.health?.showDetails ?? 'always',
        timeout: o.health?.timeout ?? 5000,
        indicators: {
          diskSpace: {
            enabled: o.health?.indicators?.diskSpace?.enabled ?? true,
            threshold: o.health?.indicators?.diskSpace?.threshold ?? 10 * 1024 * 1024,
            path: o.health?.indicators?.diskSpace?.path
              ?? (process.platform === 'win32' ? process.cwd().split('\\')[0] + '\\' : '/'),
          },
          process: {
            enabled: o.health?.indicators?.process?.enabled ?? true,
          },
        },
        groups: o.health?.groups ?? {},
        custom: o.health?.custom ?? [],
      },

      env: {
        enabled: o.env?.enabled ?? true,
        mask: {
          patterns: o.env?.mask?.patterns ?? [...DEFAULT_MASK_PATTERNS],
          additional: o.env?.mask?.additional ?? [],
          replacement: o.env?.mask?.replacement ?? '******',
        },
      },

      threadDump: {
        enabled: o.threadDump?.enabled ?? true,
      },

      heapDump: {
        enabled: o.heapDump?.enabled ?? true,
        outputDir: o.heapDump?.outputDir ?? './heapdumps',
      },

      prometheus: {
        enabled: o.prometheus?.enabled ?? true,
        defaultMetrics: o.prometheus?.defaultMetrics ?? true,
        prefix: o.prometheus?.prefix ?? '',
        customMetrics: o.prometheus?.customMetrics ?? [],
      },

      endpoints: o.endpoints ?? [],
    };
  }

  private endpointKey(method: string | undefined, id: string): string {
    return NodeActuator.endpointKey(method, id);
  }

  private normalizeEndpointId(id: string): string {
    return NodeActuator.normalizeEndpointId(id);
  }

  private static endpointKey(method: string | undefined, id: string): string {
    return `${(method ?? 'GET').toUpperCase()} ${NodeActuator.normalizeEndpointId(id)}`;
  }

  private static normalizeEndpointId(id: string): string {
    return id.replace(/^\/+/, '').replace(/\/+$/, '');
  }

  private getPackageBuildInfo(): Record<string, any> | undefined {
    try {
      const pkg = require(`${process.cwd()}/package.json`);
      return {
        name: pkg.name,
        description: pkg.description,
        version: pkg.version,
      };
    } catch {
      return undefined;
    }
  }
}

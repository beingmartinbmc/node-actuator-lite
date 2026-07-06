import { logger } from '../utils/logger';
import { ActuatorServer } from './Server';
import type { ParsedRequest, WrappedResponse } from './Server';
import {
  runEndpoint,
  healthStatusCode,
  json,
  text,
  html,
  compilePath,
  type EndpointDescriptor,
  type ActuatorRequestContext,
  type ActuatorRouteResult,
} from './router';
import { HealthCollector } from '../collectors/HealthCollector';
import { EnvironmentCollector, DEFAULT_MASK_PATTERNS } from '../collectors/EnvironmentCollector';
import { PrometheusCollector } from '../collectors/PrometheusCollector';
import { ThreadDumpCollector } from '../collectors/ThreadDumpCollector';
import { HeapDumpCollector, HeapDumpThrottledError } from '../collectors/HeapDumpCollector';
import { LoggersCollector } from '../collectors/LoggersCollector';
import { renderDashboard } from './dashboard';
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

  // Cached endpoint table + compiled regexes — rebuilt only when endpoints change.
  private cachedEndpointTable: Array<{
    descriptor: EndpointDescriptor;
    regex: RegExp;
    paramNames: string[];
  }> | null = null;

  // Collectors — exposed as readonly for advanced usage
  readonly health: HealthCollector;
  readonly env: EnvironmentCollector;
  readonly prometheus: PrometheusCollector;
  readonly threadDump: ThreadDumpCollector;
  readonly heapDump: HeapDumpCollector;
  readonly loggers: LoggersCollector;

  constructor(options: ActuatorOptions = {}) {
    this.opts = this.resolve(options);

    // Wire a custom logger if provided.
    if (options.logger) {
      logger.setDelegate(options.logger);
    }

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
    this.loggers = new LoggersCollector();
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
    if (this.opts.loggers.enabled) {
      links['loggers'] = { href: `${base}/loggers` };
      links['loggers-name'] = { href: `${base}/loggers/{name}`, templated: true };
    }
    if (this.opts.dashboard.enabled) {
      links['dashboard'] = { href: `${base}/dashboard` };
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
    this.invalidateEndpointCache();

    if (this.server) {
      this.registerDescriptorRoute(this.toDescriptor(registered));
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
  // Shared Endpoint Table
  // ===========================================================================

  /**
   * The single source of truth for every actuator endpoint. The standalone
   * HTTP server, the Express middleware, and the Fastify plugin all consume
   * this list so status codes, content types, and auth never diverge.
   */
  listEndpoints(): EndpointDescriptor[] {
    return this.getCompiledEndpoints().map((e) => e.descriptor);
  }

  /**
   * Run a specific descriptor with a request context (auth included). Used by
   * transports that have already matched the route and parsed path params
   * themselves (e.g. the Fastify plugin), so we don't re-run the matcher.
   */
  async runDescriptor(
    descriptor: EndpointDescriptor,
    ctx: ActuatorRequestContext,
  ): Promise<ActuatorRouteResult> {
    return runEndpoint(descriptor, ctx, this.opts.auth);
  }

  /**
   * Match a normalised request against the endpoint table and run it (with auth).
   * Returns `null` when no endpoint matches (caller decides 404 / passthrough).
   *
   * Uses a pre-compiled endpoint table with cached RegExp objects to avoid
   * per-request array allocations and regex compilation.
   */
  async dispatch(ctx: ActuatorRequestContext): Promise<ActuatorRouteResult | null> {
    const subPath = ctx.subPath === '' ? '/' : ctx.subPath;
    for (const entry of this.getCompiledEndpoints()) {
      if (entry.descriptor.method !== ctx.method) continue;
      const match = subPath.match(entry.regex);
      if (!match) continue;
      const params: Record<string, string> = {};
      entry.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]!);
      });
      return runEndpoint(entry.descriptor, { ...ctx, subPath, params }, this.opts.auth);
    }
    return null;
  }

  /**
   * Returns the compiled endpoint table. Builds it lazily and caches it.
   * Invalidated whenever registerEndpoint() is called.
   */
  private getCompiledEndpoints(): Array<{
    descriptor: EndpointDescriptor;
    regex: RegExp;
    paramNames: string[];
  }> {
    if (!this.cachedEndpointTable) {
      const descriptors = [...this.buildBuiltinEndpoints(), ...this.customEndpointDescriptors()];
      this.cachedEndpointTable = descriptors.map((descriptor) => {
        const { regex, paramNames } = compilePath(descriptor.path);
        return { descriptor, regex, paramNames };
      });
    }
    return this.cachedEndpointTable;
  }

  /** Invalidate the cached endpoint table (called when endpoints change). */
  private invalidateEndpointCache(): void {
    this.cachedEndpointTable = null;
  }

  private buildBuiltinEndpoints(): EndpointDescriptor[] {
    const endpoints: EndpointDescriptor[] = [];

    endpoints.push({ method: 'GET', path: '/', handle: () => json(this.discovery()) });

    if (this.opts.dashboard.enabled) {
      endpoints.push({
        method: 'GET',
        path: '/dashboard',
        handle: () => html(renderDashboard(this.opts.basePath)),
      });
    }

    if (this.opts.health.enabled) {
      endpoints.push({
        method: 'GET',
        path: '/health',
        handle: async (ctx) => {
          const result = await this.health.collect(ctx.query['showDetails']);
          return json(result, healthStatusCode(result.status));
        },
      });
      endpoints.push({
        method: 'GET',
        path: '/health/:name',
        handle: async (ctx) => {
          const name = ctx.params['name']!;
          const group = await this.health.group(name);
          if (group) return json(group, healthStatusCode(group.status));
          const comp = await this.health.component(name);
          if (!comp) return json({ error: `Health component '${name}' not found` }, 404);
          return json(comp, healthStatusCode(comp.status));
        },
      });
    }

    if (this.opts.env.enabled) {
      endpoints.push({ method: 'GET', path: '/env', handle: () => json(this.env.collect()) });
      endpoints.push({
        method: 'GET',
        path: '/env/:name',
        handle: (ctx) => {
          const name = ctx.params['name']!;
          const result = this.env.variable(name);
          return result ? json(result) : json({ error: `Variable '${name}' not found` }, 404);
        },
      });
    }

    if (this.opts.threadDump.enabled) {
      endpoints.push({ method: 'GET', path: '/threaddump', handle: () => json(this.threadDump.collect()) });
    }

    if (this.opts.heapDump.enabled) {
      endpoints.push({
        method: 'POST',
        path: '/heapdump',
        handle: async () => {
          try {
            return json(await this.heapDump.collect());
          } catch (err) {
            if (err instanceof HeapDumpThrottledError) {
              return json({ error: err.message }, 429);
            }
            throw err;
          }
        },
      });
    }

    if (this.opts.prometheus.enabled) {
      endpoints.push({
        method: 'GET',
        path: '/prometheus',
        handle: async () => text(await this.prometheus.collect()),
      });
    }

    if (this.opts.info.enabled) {
      endpoints.push({ method: 'GET', path: '/info', handle: async () => json(await this.getInfoAsync()) });
    }

    if (this.opts.metrics.enabled) {
      endpoints.push({ method: 'GET', path: '/metrics', handle: () => json(this.getMetrics()) });
    }

    if (this.opts.loggers.enabled) {
      endpoints.push({
        method: 'GET',
        path: '/loggers',
        handle: () => json(this.loggers.collect()),
      });
      endpoints.push({
        method: 'GET',
        path: '/loggers/:name',
        handle: (ctx) => {
          const name = ctx.params['name'] ?? '';
          const info = this.loggers.getLogger(name);
          if (!info) return json({ error: 'Logger not found' }, 404);
          return json(info);
        },
      });
      endpoints.push({
        method: 'POST',
        path: '/loggers/:name',
        handle: (ctx) => {
          const name = ctx.params['name'] ?? '';
          const body = ctx.body as { configuredLevel?: string } | undefined;
          const level = body?.configuredLevel;
          if (!level) return json({ error: 'configuredLevel is required' }, 400);
          const validLevels = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'OFF'];
          if (!validLevels.includes(level.toUpperCase())) {
            return json({ error: `Invalid level: ${level}. Valid: ${validLevels.join(', ')}` }, 400);
          }
          const ok = this.loggers.setLevel(name, level.toUpperCase() as any);
          if (!ok) return json({ error: 'Failed to set level' }, 500);
          return json({ status: 'ok', logger: name, level: level.toUpperCase() });
        },
      });
    }

    return endpoints;
  }

  private customEndpointDescriptors(): EndpointDescriptor[] {
    return [...this.customEndpoints.values()].map((e) => this.toDescriptor(e));
  }

  private toDescriptor(endpoint: CustomEndpointRegistration): EndpointDescriptor {
    const method = (endpoint.method ?? 'GET') as 'GET' | 'POST';
    return {
      method,
      path: `/${this.normalizeEndpointId(endpoint.id)}`,
      handle: async (ctx): Promise<ActuatorRouteResult> => {
        const result = await endpoint.handler({
          method: ctx.method,
          path: ctx.subPath,
          params: ctx.params,
          query: ctx.query,
          raw: ctx.raw,
        });
        return endpoint.contentType === 'text' ? text(String(result)) : json(result);
      },
    };
  }

  // ===========================================================================
  // Standalone HTTP Route Registration
  // ===========================================================================

  private registerRoutes(): void {
    for (const descriptor of this.listEndpoints()) {
      this.registerDescriptorRoute(descriptor);
    }
  }

  private registerDescriptorRoute(descriptor: EndpointDescriptor): void {
    this.server!.route(descriptor.method, descriptor.path, async (req, res) => {
      const result = await runEndpoint(descriptor, this.toRequestContext(req), this.opts.auth);
      this.sendResult(result, res);
    });
  }

  private toRequestContext(req: ParsedRequest): ActuatorRequestContext {
    return {
      method: req.method,
      subPath: req.path,
      params: req.params,
      query: req.query,
      body: req.body,
      raw: req.raw,
    };
  }

  private sendResult(result: ActuatorRouteResult, res: WrappedResponse): void {
    if (result.contentType === 'text') {
      res.status(result.status).text(String(result.body));
      return;
    }
    if (result.contentType === 'html') {
      res.status(result.status).html(String(result.body));
      return;
    }
    res.status(result.status).json(result.body);
  }

  // ===========================================================================
  // Config Resolution
  // ===========================================================================

  private resolve(o: ActuatorOptions): ResolvedActuatorOptions {
    // `preset` must be explicit. Auto-flipping endpoint defaults from NODE_ENV
    // alone would silently disable endpoints for existing deployments on
    // upgrade — instead we only *warn* below when NODE_ENV=production is seen
    // without an explicit preset, nudging towards preset: 'production'.
    const preset = o.preset;
    const isProd = preset === 'production';
    const nodeEnvIsProdWithoutPreset = preset === undefined && process.env['NODE_ENV'] === 'production';

    // Production defaults: sensitive endpoints off, health details hidden.
    const prodEnvEnabled = isProd ? false : true;
    const prodThreadDumpEnabled = isProd ? false : true;
    const prodHeapDumpEnabled = isProd ? false : true;
    const prodLoggersEnabled = isProd ? false : true;
    const prodDashboardEnabled = isProd ? false : true;
    const prodShowDetails: 'never' | 'always' = isProd ? 'never' : 'always';

    const resolved: ResolvedActuatorOptions = {
      port: o.port ?? 0,
      basePath: o.basePath ?? '/actuator',
      serverless: o.serverless ?? false,
      auth: o.auth,

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
        showDetails: o.health?.showDetails ?? prodShowDetails,
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
        enabled: o.env?.enabled ?? prodEnvEnabled,
        mask: {
          patterns: o.env?.mask?.patterns ?? [...DEFAULT_MASK_PATTERNS],
          additional: o.env?.mask?.additional ?? [],
          replacement: o.env?.mask?.replacement ?? '******',
          allowlist: o.env?.mask?.allowlist,
        },
      },

      threadDump: {
        enabled: o.threadDump?.enabled ?? prodThreadDumpEnabled,
      },

      heapDump: {
        enabled: o.heapDump?.enabled ?? prodHeapDumpEnabled,
        outputDir: o.heapDump?.outputDir ?? './heapdumps',
        minIntervalMs: o.heapDump?.minIntervalMs ?? 60000,
      },

      prometheus: {
        enabled: o.prometheus?.enabled ?? true,
        defaultMetrics: o.prometheus?.defaultMetrics ?? true,
        prefix: o.prometheus?.prefix ?? '',
        customMetrics: o.prometheus?.customMetrics ?? [],
        ...(o.prometheus?.registry ? { registry: o.prometheus.registry } : {}),
      },

      dashboard: {
        enabled: o.dashboard?.enabled ?? prodDashboardEnabled,
      },

      loggers: {
        enabled: o.loggers?.enabled ?? prodLoggersEnabled,
      },

      endpoints: o.endpoints ?? [],
    };

    if (nodeEnvIsProdWithoutPreset) {
      logger.warn(
        `NODE_ENV=production detected but no 'preset' was set — endpoints keep their ` +
        `configured defaults (nothing was auto-disabled). Set preset: 'production' to ` +
        `disable sensitive endpoints (/env, /threaddump, /heapdump, /loggers, /dashboard) ` +
        `and hide health details by default.`,
      );
    }

    // Emit loud warnings when sensitive endpoints are enabled without auth.
    if (!resolved.auth) {
      const sensitiveEndpoints: string[] = [];
      if (resolved.env.enabled) sensitiveEndpoints.push('/env');
      if (resolved.threadDump.enabled) sensitiveEndpoints.push('/threaddump');
      if (resolved.heapDump.enabled) sensitiveEndpoints.push('/heapdump');
      if (resolved.loggers.enabled) sensitiveEndpoints.push('/loggers');

      if (sensitiveEndpoints.length > 0) {
        logger.warn(
          `Sensitive endpoints enabled without auth: ${sensitiveEndpoints.join(', ')}. ` +
          `Set an 'auth' callback or use preset: 'production' to disable them by default.`,
        );
      }
    }

    return resolved;
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

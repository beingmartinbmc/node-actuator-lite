import express, { Request, Response, NextFunction, Router } from 'express';
import { register, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';
import { HealthChecker } from '../health/HealthChecker';
import { MetricsCollector } from '../metrics/MetricsCollector';
import { InfoCollector } from '../info/InfoCollector';
import { EnvironmentCollector } from '../env/EnvironmentCollector';
import logger from '../utils/logger';
import { validateConfig, ValidatedActuatorOptions } from '../utils/config';
import { HeapDumpGenerator } from '../utils/heapDump';
import { ThreadDumpCollector } from '../utils/threadDump';

export interface ActuatorMiddlewareOptions {
  basePath?: string;
  enableHealth?: boolean;
  enableMetrics?: boolean;
  enableInfo?: boolean;
  enableEnv?: boolean;
  enablePrometheus?: boolean;
  enableMappings?: boolean;
  enableBeans?: boolean;
  enableConfigProps?: boolean;
  enableThreadDump?: boolean;
  enableHeapDump?: boolean;
  heapDumpOptions?: {
    outputDir?: string;
    filename?: string;
    includeTimestamp?: boolean;
    compress?: boolean;
    maxDepth?: number;
  };
  customHealthChecks?: Array<() => Promise<{ status: string; details?: any }>>;
  customMetrics?: Array<{ name: string; help: string; type: 'counter' | 'gauge' | 'histogram' }>;
  customBeans?: Record<string, any>;
  customConfigProps?: Record<string, any>;
  healthOptions?: {
    includeDiskSpace?: boolean;
    includeProcess?: boolean;
    diskSpaceThreshold?: number;
    diskSpacePath?: string;
    healthCheckTimeout?: number;
    customIndicators?: Array<{
      name: string;
      check: () => Promise<{ status: string; details?: any }>;
      enabled?: boolean;
      critical?: boolean;
    }>;
  };
  retryOptions?: {
    maxRetries?: number;
    retryDelay?: number;
    exponentialBackoff?: boolean;
  };
}

export class ActuatorMiddleware {
  private router: Router;
  private basePath: string;
  private healthChecker: HealthChecker;
  private metricsCollector: MetricsCollector;
  private infoCollector: InfoCollector;
  private envCollector: EnvironmentCollector;
  private options: ValidatedActuatorOptions;
  private routes: Array<{ method: string; path: string; handler: string }> = [];
  private heapDumpGenerator?: HeapDumpGenerator;
  private threadDumpCollector?: ThreadDumpCollector;
  private customMetrics: Map<string, any> = new Map();

  // Default Prometheus metrics (unused in middleware but kept for compatibility)
  // private httpRequestsTotal!: Counter;
  // private httpRequestDuration!: Histogram;
  // private httpRequestsInProgress!: Gauge;

  constructor(options: ActuatorMiddlewareOptions = {}) {
    // Validate configuration
    const validatedOptions = validateConfig({
      basePath: '/actuator',
      enableHealth: true,
      enableMetrics: true,
      enableInfo: true,
      enableEnv: true,
      enablePrometheus: true,
      enableMappings: true,
      enableBeans: true,
      enableConfigProps: true,
      enableThreadDump: true,
      enableHeapDump: true,
      customHealthChecks: [],
      customMetrics: [],
      customBeans: {},
      customConfigProps: {},
      ...options
    });

    this.options = validatedOptions;
    this.basePath = validatedOptions.basePath;
    this.router = express.Router();

    // Initialize collectors
    this.healthChecker = new HealthChecker([], validatedOptions.healthOptions);
    this.metricsCollector = new MetricsCollector();
    this.infoCollector = new InfoCollector();
    this.envCollector = new EnvironmentCollector();

    // Initialize Prometheus metrics
    this.initializePrometheusMetrics();

    // Setup routes
    this.setupRoutes();

    // Setup error handling
    this.setupErrorHandling();

    // Initialize heap dump and thread dump if enabled
    if (validatedOptions.enableHeapDump) {
      this.heapDumpGenerator = new HeapDumpGenerator(validatedOptions.heapDumpOptions);
    }

    if (validatedOptions.enableThreadDump) {
      this.threadDumpCollector = new ThreadDumpCollector();
    }

    // Add custom health checks
    validatedOptions.customHealthChecks.forEach(check => {
      this.healthChecker.addHealthIndicator({
        name: 'custom',
        check,
        enabled: true,
        critical: false
      });
    });

    // Add custom health indicators from options
    if (validatedOptions.healthOptions?.customIndicators) {
      validatedOptions.healthOptions.customIndicators.forEach(indicator => {
        this.healthChecker.addHealthIndicator({
          name: indicator.name,
          check: indicator.check,
          enabled: indicator.enabled ?? true,
          critical: indicator.critical ?? false
        });
      });
    }

    // Add custom metrics
    validatedOptions.customMetrics.forEach(metric => {
      this.addCustomMetric(metric.name, metric.help, metric.type);
    });

    // Add custom beans and config props (these methods don't exist in InfoCollector, so we'll handle them differently)
    // this.infoCollector.addCustomBeans(validatedOptions.customBeans);
    // this.infoCollector.addCustomConfigProps(validatedOptions.customConfigProps);

    logger.info({ basePath: this.basePath }, 'ActuatorMiddleware initialized');
  }

  private initializePrometheusMetrics(): void {
    if (!ActuatorMiddleware.defaultMetricsInitialized) {
      collectDefaultMetrics();
      ActuatorMiddleware.defaultMetricsInitialized = true;
    }

    // HTTP metrics are not needed for middleware since it doesn't handle HTTP requests directly
    // if (!ActuatorMiddleware.httpMetricsInitialized) {
    //   ActuatorMiddleware.httpRequestsTotal = new Counter({
    //     name: 'http_requests_total',
    //     help: 'Total number of HTTP requests',
    //     labelNames: ['method', 'route', 'status']
    //   });

    //   ActuatorMiddleware.httpRequestDuration = new Histogram({
    //     name: 'http_request_duration_seconds',
    //     help: 'HTTP request duration in seconds',
    //     labelNames: ['method', 'route']
    //   });

    //   ActuatorMiddleware.httpRequestsInProgress = new Gauge({
    //     name: 'http_requests_in_progress',
    //     help: 'Number of HTTP requests currently in progress',
    //     labelNames: ['method', 'route']
    //   });

    //   ActuatorMiddleware.httpMetricsInitialized = true;
    // }

    // this.httpRequestsTotal = ActuatorMiddleware.httpRequestsTotal;
    // this.httpRequestDuration = ActuatorMiddleware.httpRequestDuration;
    // this.httpRequestsInProgress = ActuatorMiddleware.httpRequestsInProgress;
  }

  private setupRoutes(): void {
    // Track actuator's own routes for mappings endpoint
    const actuatorRoutes = [
      { method: 'GET', path: `${this.basePath}/health`, handler: 'Health Check Endpoint' },
      { method: 'GET', path: `${this.basePath}/metrics`, handler: 'Metrics Endpoint' },
      { method: 'GET', path: `${this.basePath}/prometheus`, handler: 'Prometheus Metrics Endpoint' },
      { method: 'GET', path: `${this.basePath}/info`, handler: 'Application Info Endpoint' },
      { method: 'GET', path: `${this.basePath}/env`, handler: 'Environment Info Endpoint' },
      { method: 'GET', path: `${this.basePath}/threaddump`, handler: 'Thread Dump Endpoint' },
      { method: 'POST', path: `${this.basePath}/heapdump`, handler: 'Heap Dump Generation Endpoint' },
      { method: 'GET', path: `${this.basePath}/mappings`, handler: 'Route Mappings Endpoint' },
      { method: 'GET', path: `${this.basePath}/modules`, handler: 'Application Modules Endpoint' },
      { method: 'GET', path: `${this.basePath}/configprops`, handler: 'Configuration Properties Endpoint' }
    ];

    // Add actuator routes to the routes array
    actuatorRoutes.forEach(route => {
      if (!this.routes.find(r => r.method === route.method && r.path === route.path)) {
        this.routes.push(route);
      }
    });

    // Health endpoint
    if (this.options.enableHealth) {
      this.router.get(`${this.basePath}/health`, async (_req: Request, res: Response) => {
        try {
          const health = await this.executeWithRetry(
            () => this.healthChecker.check(),
            'Health check'
          );
          
          logger.debug({ status: health.status }, 'Health check completed');
          
          // Build details.checks array and components object
          const checks = [];
          const components: any = {};
          let anyCheckDown = false;
          if (health.details && health.details['checks']) {
            for (const check of health.details['checks']) {
              checks.push(check);
              components[check.name] = {
                status: check.status,
                details: check.details
              };
              if (check.status === 'DOWN') {
                anyCheckDown = true;
              }
            }
          }

          const transformedHealth: any = {
            status: health.status,
            details: { checks },
            components,
            timestamp: health.timestamp,
            uptime: health.uptime
          };

          // Add response time to details
          if (health.details && health.details['responseTime']) {
            transformedHealth.details.responseTime = health.details['responseTime'];
          }

          // Set appropriate status code based on health status or any check being DOWN
          if (health.status === 'DOWN' || anyCheckDown) {
            transformedHealth.status = 'DOWN';
            // Add error property if any check is down
            const firstDown = checks.find((c: any) => c.status === 'DOWN');
            if (firstDown && firstDown.details && firstDown.details.error) {
              transformedHealth.error = firstDown.details.error;
            } else {
              transformedHealth.error = 'One or more health checks failed';
            }
            res.status(500).json(transformedHealth);
          } else {
            res.status(200).json(transformedHealth);
          }
        } catch (error) {
          logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Health check failed');
          res.status(500).json({ 
            status: 'DOWN', 
            details: { checks: [] },
            components: {},
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });
    }

    // Metrics endpoint
    if (this.options.enableMetrics) {
      this.router.get(`${this.basePath}/metrics`, async (_req: Request, res: Response) => {
        try {
          const metrics = await this.executeWithRetry(
            () => this.metricsCollector.collect(),
            'Metrics collection'
          );
          logger.debug('Metrics collected successfully');
          res.json(metrics);
        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Metrics collection failed after all retries');
          
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Metrics collection failed after multiple attempts'
          });
        }
      });
    }

    // Prometheus endpoint
    if (this.options.enablePrometheus) {
      this.router.get(`${this.basePath}/prometheus`, async (_req: Request, res: Response) => {
        try {
          res.set('Content-Type', register.contentType);
          const metrics = await register.metrics();
          res.end(metrics);
        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Prometheus metrics collection failed');
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Prometheus metrics collection failed'
          });
        }
      });
    }

    // Info endpoint
    if (this.options.enableInfo) {
      this.router.get(`${this.basePath}/info`, async (_req: Request, res: Response) => {
        try {
          const info = await this.executeWithRetry(
            () => this.infoCollector.collect(),
            'Info collection'
          );
          logger.debug('Info collected successfully');
          res.json(info);
        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Info collection failed after all retries');
          
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Info collection failed after multiple attempts'
          });
        }
      });
    }

    // Environment endpoint
    if (this.options.enableEnv) {
      this.router.get(`${this.basePath}/env`, async (_req: Request, res: Response) => {
        try {
          const env = await this.executeWithRetry(
            () => this.envCollector.collect(),
            'Environment collection'
          );
          logger.debug('Environment info collected successfully');
          res.json(env);
        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Environment collection failed after all retries');
          
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Environment collection failed after multiple attempts'
          });
        }
      });
    }

    // Thread dump endpoint
    if (this.options.enableThreadDump && this.threadDumpCollector) {
      this.router.get(`${this.basePath}/threaddump`, async (_req: Request, res: Response) => {
        try {
          const threadDump = await this.executeWithRetry(
            () => this.threadDumpCollector!.collectThreadDump(),
            'Thread dump collection'
          );
          logger.debug('Thread dump collected successfully');
          res.json(threadDump);
        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Thread dump collection failed after all retries');
          
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Thread dump collection failed after multiple attempts'
          });
        }
      });
    }

    // Heap dump endpoint
    if (this.options.enableHeapDump && this.heapDumpGenerator) {
      this.router.post(`${this.basePath}/heapdump`, async (_req: Request, res: Response) => {
        try {
          const heapDump = await this.executeWithRetry(
            () => this.heapDumpGenerator!.generateHeapDump(),
            'Heap dump generation'
          );
          logger.debug('Heap dump generated successfully');
          res.json(heapDump);
        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Heap dump generation failed after all retries');
          
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Heap dump generation failed after multiple attempts'
          });
        }
      });
    }

    // Mappings endpoint
    if (this.options.enableMappings) {
      this.router.get(`${this.basePath}/mappings`, (_req: Request, res: Response) => {
        try {
          const mappings = {
            context: {
              mappings: {
                dispatcherServlets: {
                  dispatcherServlet: this.routes.map(route => ({
                    handler: route.handler,
                    predicate: `${route.method} ${route.path}`,
                    details: {
                      requestMappingConditions: {
                        methods: [route.method],
                        patterns: [route.path]
                      }
                    }
                  }))
                }
              }
            }
          };
          res.json(mappings);
        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Mappings collection failed');
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Mappings collection failed'
          });
        }
      });
    }

    // Beans endpoint
    if (this.options.enableBeans) {
      this.router.get(`${this.basePath}/beans`, async (_req: Request, res: Response) => {
        try {
          // Since InfoCollector doesn't have getBeans method, we'll return a basic structure
          const beans = {
            context: {
              beans: {
                infoCollector: {
                  aliases: [],
                  scope: 'singleton',
                  type: 'InfoCollector',
                  resource: 'class path resource',
                  dependencies: []
                }
              }
            }
          };
          logger.debug('Beans collected successfully');
          res.json(beans);
        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Beans collection failed');
          
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Beans collection failed'
          });
        }
      });
    }

    // Config props endpoint
    if (this.options.enableConfigProps) {
      this.router.get(`${this.basePath}/configprops`, async (_req: Request, res: Response) => {
        try {
          // Since InfoCollector doesn't have getConfigProps method, we'll return a basic structure
          const configProps = {
            contexts: {
              application: {
                beans: {
                  'app.name': {
                    prefix: 'app',
                    properties: {
                      'app.name': 'Node Actuator Lite',
                      'app.version': '1.0.0',
                      'app.environment': process.env['NODE_ENV'] || 'development'
                    }
                  }
                }
              }
            }
          };
          logger.debug('Config props collected successfully');
          res.json(configProps);
        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Config props collection failed');
          
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Config props collection failed'
          });
        }
      });
    }
  }

  private setupErrorHandling(): void {
    this.router.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error({ error: error.message, stack: error.stack }, 'Unhandled error in actuator middleware');
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    });
  }

  // Static properties for metrics
  private static defaultMetricsInitialized = false;
  // private static httpMetricsInitialized = false;
  // private static httpRequestsTotal: Counter;
  // private static httpRequestDuration: Histogram;
  // private static httpRequestsInProgress: Gauge;

  // Public methods
  public getRouter(): Router {
    return this.router;
  }

  public getBasePath(): string {
    return this.basePath;
  }

  // Health Check API Methods
  public addHealthIndicator(name: string, check: () => Promise<{ status: string; details?: any }>, options?: { enabled?: boolean; critical?: boolean }): void {
    this.healthChecker.addHealthIndicator({
      name,
      check,
      enabled: options?.enabled ?? true,
      critical: options?.critical ?? false
    });
  }

  public addDatabaseHealthCheck(name: string, check: () => Promise<{ status: string; details?: any }>, options?: { enabled?: boolean; critical?: boolean }): void {
    this.addHealthIndicator(name, check, { ...options, critical: options?.critical ?? true });
  }

  public addCacheHealthCheck(name: string, check: () => Promise<{ status: string; details?: any }>, options?: { enabled?: boolean; critical?: boolean }): void {
    this.addHealthIndicator(name, check, { ...options, critical: options?.critical ?? false });
  }

  public addExternalServiceHealthCheck(name: string, check: () => Promise<{ status: string; details?: any }>, options?: { enabled?: boolean; critical?: boolean }): void {
    this.addHealthIndicator(name, check, { ...options, critical: options?.critical ?? false });
  }

  public removeHealthIndicator(name: string): void {
    this.healthChecker.removeHealthIndicator(name);
  }

  public getHealthIndicators(): Array<{ name: string; enabled: boolean; critical: boolean }> {
    return this.healthChecker.getHealthIndicators();
  }

  // Metrics API Methods
  public addCustomMetric(name: string, help: string, type: 'counter' | 'gauge' | 'histogram', options?: { labelNames?: string[] }): any {
    try {
      // For counters, ensure _total suffix
      if (type === 'counter' && !name.endsWith('_total')) {
        name = name + '_total';
      }
      // Check if metric already exists
      if (this.customMetrics.has(name)) {
        return this.customMetrics.get(name);
      }
      let prometheusMetric;
      const config: any = { name, help };
      if (options?.labelNames) {
        config.labelNames = options.labelNames;
      }
      switch (type) {
        case 'counter':
          prometheusMetric = new Counter(config);
          break;
        case 'gauge':
          prometheusMetric = new Gauge(config);
          break;
        case 'histogram':
          prometheusMetric = new Histogram(config);
          break;
        default:
          throw new Error(`Unsupported metric type: ${type}`);
      }
      this.customMetrics.set(name, prometheusMetric);
      return prometheusMetric;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error', name, type }, 'Failed to add custom metric');
      throw error;
    }
  }

  public getCustomMetric(name: string): any {
    return this.customMetrics.get(name);
  }

  // Heap dump API Methods
  public async generateHeapDump(): Promise<any> {
    if (!this.heapDumpGenerator) {
      throw new Error('Heap dump is not enabled');
    }
    return await this.heapDumpGenerator.generateHeapDump();
  }

  public getHeapDumpStats(): any {
    if (!this.heapDumpGenerator) {
      throw new Error('Heap dump is not enabled');
    }
    return this.heapDumpGenerator.getHeapDumpStats();
  }

  public cleanupOldHeapDumps(maxAge?: number): void {
    if (!this.heapDumpGenerator) {
      throw new Error('Heap dump is not enabled');
    }
    this.heapDumpGenerator.cleanupOldDumps(maxAge);
  }

  // Route registration methods
  public registerRoute(method: string, path: string, handler: string): void {
    const route = { method: method.toUpperCase(), path, handler };
    const existingIndex = this.routes.findIndex(r => r.method === route.method && r.path === route.path);
    if (existingIndex >= 0) {
      this.routes[existingIndex] = route;
    } else {
      this.routes.push(route);
    }
  }

  public registerCustomRoute(method: string, path: string, handler: string): void {
    this.registerRoute(method, path, handler);
  }

  public registerCustomRoutes(routes: Array<{ method: string; path: string; handler: string }>): void {
    routes.forEach(route => {
      this.registerRoute(route.method, route.path, route.handler);
    });
  }

  // Static methods
  public static resetDefaultMetricsFlag(): void {
    ActuatorMiddleware.defaultMetricsInitialized = false;
  }

  // Private helper methods
  private async executeWithRetry<T>(
    operation: () => Promise<T>, 
    operationName: string
  ): Promise<T> {
    const maxRetries = this.options.retryOptions?.maxRetries ?? 3;
    const retryDelay = this.options.retryOptions?.retryDelay ?? 100;
    const exponentialBackoff = this.options.retryOptions?.exponentialBackoff ?? true;
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          logger.error({ 
            error: lastError.message, 
            operation: operationName, 
            attempts: attempt + 1 
          }, `${operationName} failed after ${maxRetries} attempts`);
          break;
        }
        
        const delay = exponentialBackoff ? retryDelay * Math.pow(2, attempt) : retryDelay;
        logger.warn({ 
          error: lastError.message, 
          operation: operationName, 
          attempt: attempt + 1, 
          maxRetries, 
          delay 
        }, `${operationName} failed, retrying in ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
  }
} 
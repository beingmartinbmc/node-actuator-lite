import express, { Express, Request, Response, NextFunction } from 'express';
import { register, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';
import { HealthChecker } from '../health/HealthChecker';
import { MetricsCollector } from '../metrics/MetricsCollector';
import { InfoCollector } from '../info/InfoCollector';
import { EnvironmentCollector } from '../env/EnvironmentCollector';
import logger from '../utils/logger';
import { validateConfig, ValidatedActuatorOptions } from '../utils/config';

import { ErrorHandler } from '../utils/errorHandler';
import { HeapDumpGenerator } from '../utils/heapDump';
import { ThreadDumpCollector } from '../utils/threadDump';

export interface ActuatorOptions {
  port?: number;
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

export class Actuator {
  private app: Express;
  private port: number;
  private basePath: string;
  private healthChecker: HealthChecker;
  private metricsCollector: MetricsCollector;
  private infoCollector: InfoCollector;
  private envCollector: EnvironmentCollector;
  private options: ValidatedActuatorOptions;
  private routes: Array<{ method: string; path: string; handler: string }> = [];

  private server?: any;
  private heapDumpGenerator?: HeapDumpGenerator;
  private threadDumpCollector?: ThreadDumpCollector;
  private customMetrics: Map<string, any> = new Map();

  // Default Prometheus metrics
  private httpRequestsTotal!: Counter;
  private httpRequestDuration!: Histogram;
  private httpRequestsInProgress!: Gauge;

  constructor(options: ActuatorOptions = {}) {
    // Validate configuration
    const validatedOptions = validateConfig({
      port: 0, // Use dynamic port by default to avoid conflicts
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
    this.port = this.options.port;
    this.basePath = this.options.basePath;
    

    
    this.app = express();
    this.app.use(express.json());
    
    // Initialize collectors
    this.healthChecker = new HealthChecker(
      this.options.customHealthChecks,
      this.options.healthOptions
    );
    this.metricsCollector = new MetricsCollector();
    this.infoCollector = new InfoCollector();
    this.envCollector = new EnvironmentCollector();
    
    // Initialize heap dump generator if enabled
    if (this.options.enableHeapDump) {
      this.heapDumpGenerator = new HeapDumpGenerator(this.options.heapDumpOptions);
    }

    // Initialize thread dump collector if enabled
    if (this.options.enableThreadDump) {
      this.threadDumpCollector = new ThreadDumpCollector();
    }

    // Initialize Prometheus metrics
    if (this.options.enablePrometheus) {
      this.initializePrometheusMetrics();
      
      // Initialize custom metrics from options
      if (this.options.customMetrics) {
        for (const metric of this.options.customMetrics) {
          this.addCustomMetric(metric.name, metric.help, metric.type);
        }
      }
    }

    // Setup middleware
    this.setupMiddleware();
    
    // Setup routes
    this.setupRoutes();
    
    // Setup error handling
    this.setupErrorHandling();

    logger.info({ 
      port: this.port, 
      basePath: this.basePath,
      features: {
        health: this.options.enableHealth,
        metrics: this.options.enableMetrics,
        prometheus: this.options.enablePrometheus
      }
    }, 'Actuator initialized');
  }

  private static defaultMetricsInitialized = false;
  private static httpMetricsInitialized = false;
  private static httpRequestsTotal: Counter;
  private static httpRequestDuration: Histogram;
  private static httpRequestsInProgress: Gauge;

  private initializePrometheusMetrics(): void {
    // Collect default metrics only once
    if (!Actuator.defaultMetricsInitialized) {
      try {
        collectDefaultMetrics({ register });
        Actuator.defaultMetricsInitialized = true;
        logger.info('Default Prometheus metrics initialized');
      } catch (error) {
        // If metrics are already registered, just continue
        logger.warn('Default metrics already registered, skipping...');
      }
    }

    // Initialize HTTP metrics only once
    if (!Actuator.httpMetricsInitialized) {
      try {
        Actuator.httpRequestsTotal = new Counter({
          name: 'http_requests_total',
          help: 'Total number of HTTP requests',
          labelNames: ['method', 'route', 'status_code']
        });

        Actuator.httpRequestDuration = new Histogram({
          name: 'http_request_duration_seconds',
          help: 'HTTP request duration in seconds',
          labelNames: ['method', 'route']
        });

        Actuator.httpRequestsInProgress = new Gauge({
          name: 'http_requests_in_progress',
          help: 'Number of HTTP requests currently in progress',
          labelNames: ['method', 'route']
        });

        Actuator.httpMetricsInitialized = true;
        logger.info('HTTP Prometheus metrics initialized');
      } catch (error) {
        // If metrics are already registered, just continue
        logger.warn('HTTP metrics already registered, skipping...');
      }
    }

    // Assign static metrics to instance
    this.httpRequestsTotal = Actuator.httpRequestsTotal;
    this.httpRequestDuration = Actuator.httpRequestDuration;
    this.httpRequestsInProgress = Actuator.httpRequestsInProgress;

    // Register custom metrics
    this.options.customMetrics?.forEach(metric => {
      try {
        let prometheusMetric;
        switch (metric.type) {
          case 'counter':
            prometheusMetric = new Counter({ name: metric.name, help: metric.help });
            break;
          case 'gauge':
            prometheusMetric = new Gauge({ name: metric.name, help: metric.help });
            break;
          case 'histogram':
            prometheusMetric = new Histogram({ name: metric.name, help: metric.help });
            break;
        }
        if (prometheusMetric) {
          this.customMetrics.set(metric.name, prometheusMetric);
        }
        logger.debug({ metric: metric.name, type: metric.type }, 'Custom metric registered');
      } catch (error) {
        logger.error({ metric: metric.name, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to register custom metric');
      }
    });
  }

  private setupMiddleware(): void {
    // Add request ID middleware
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      req.headers['x-request-id'] = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      next();
    });



    // Request logging and metrics middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      // Log incoming request
      logger.info({ 
        method: req.method, 
        path: req.path, 
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }, 'Incoming request');
      
      // Track routes for mappings endpoint
      if (this.options.enableMappings && !this.routes.find(r => r.method === req.method && r.path === req.path)) {
        this.routes.push({
          method: req.method,
          path: req.path,
          handler: `${req.method} ${req.path}`
        });
      }
      
      if (this.options.enablePrometheus) {
        this.httpRequestsInProgress.inc({ method: req.method, route: req.path });
      }

      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        
        // Log response
        logger.info({ 
          method: req.method, 
          path: req.path, 
          statusCode: res.statusCode, 
          duration: `${duration.toFixed(3)}s`
        }, 'Request completed');
        
        if (this.options.enablePrometheus) {
          this.httpRequestsTotal.inc({ 
            method: req.method, 
            route: req.path, 
            status_code: res.statusCode 
          });
          
          this.httpRequestDuration.observe({ 
            method: req.method, 
            route: req.path 
          }, duration);
          
          this.httpRequestsInProgress.dec({ method: req.method, route: req.path });
        }
      });

      next();
    });
  }

  private setupRoutes(): void {
    // Health endpoint
    if (this.options.enableHealth) {
      this.app.get(`${this.basePath}/health`, async (_req: Request, res: Response) => {
        try {
          const health = await this.executeWithRetry(
            () => this.healthChecker.check(),
            'Health check'
          );
          
          logger.debug({ status: health.status }, 'Health check completed');
          
          // Build details.checks array and components object
          const checks = [];
          const components: any = {};
          if (health.details && health.details['checks']) {
            for (const check of health.details['checks']) {
              checks.push(check);
              components[check.name] = {
                status: check.status,
                details: check.details
              };
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

          // Set appropriate status code based on health status
          // Following Spring Boot Actuator conventions:
          // - UP: 200 OK
          // - DOWN: 503 Service Unavailable
          // - UNKNOWN: 200 OK (but status field indicates UNKNOWN)
          if (health.status === 'DOWN') {
            res.status(503).json(transformedHealth);
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
      this.app.get(`${this.basePath}/metrics`, async (_req: Request, res: Response) => {
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
      this.app.get(`${this.basePath}/prometheus`, async (_req: Request, res: Response) => {
        try {
          const metrics = await this.executeWithRetry(
            () => register.metrics(),
            'Prometheus metrics collection'
          );
          res.set('Content-Type', register.contentType);
          logger.debug('Prometheus metrics served');
          res.end(metrics);
        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Prometheus metrics failed after all retries');
          
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Prometheus metrics collection failed after multiple attempts'
          });
        }
      });
    }

    // Info endpoint
    if (this.options.enableInfo) {
      this.app.get(`${this.basePath}/info`, async (_req: Request, res: Response) => {
        try {
          const info = await this.executeWithRetry(
            () => this.infoCollector.collect(),
            'Info collection'
          );
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
      this.app.get(`${this.basePath}/env`, async (_req: Request, res: Response) => {
        try {
          const env = await this.executeWithRetry(
            () => this.envCollector.collect(),
            'Environment collection'
          );
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

    // Mappings endpoint (similar to Spring Boot's /actuator/mappings)
    if (this.options.enableMappings) {
      this.app.get(`${this.basePath}/mappings`, (_req: Request, res: Response) => {
        try {
          const mappings = {
            context: {
              mappings: {
                dispatcherServlets: {
                  dispatcherServlet: this.routes
                }
              }
            }
          };
          res.json(mappings);
        } catch (error) {
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });
    }

    // Modules endpoint (Node.js equivalent of Spring Boot's /actuator/beans)
    if (this.options.enableBeans) {
      this.app.get(`${this.basePath}/modules`, (_req: Request, res: Response) => {
        try {
          const modules = {
            application: {
              modules: {
                ...this.options.customBeans,
                actuator: {
                  type: 'node-actuator-lite.Actuator',
                  version: '1.0.0',
                  dependencies: ['healthChecker', 'metricsCollector', 'infoCollector', 'envCollector'],
                  status: 'active'
                },
                healthChecker: {
                  type: 'node-actuator-lite.HealthChecker',
                  version: '1.0.0',
                  status: 'active'
                },
                metricsCollector: {
                  type: 'node-actuator-lite.MetricsCollector',
                  version: '1.0.0',
                  status: 'active'
                },
                infoCollector: {
                  type: 'node-actuator-lite.InfoCollector',
                  version: '1.0.0',
                  status: 'active'
                },
                envCollector: {
                  type: 'node-actuator-lite.EnvironmentCollector',
                  version: '1.0.0',
                  status: 'active'
                }
              }
            }
          };
          res.json(modules);
        } catch (error) {
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });
    }

    // Configprops endpoint (similar to Spring Boot's /actuator/configprops)
    if (this.options.enableConfigProps) {
      this.app.get(`${this.basePath}/configprops`, (_req: Request, res: Response) => {
        try {
          const response = {
            contexts: {
              application: {
                beans: {
                  'actuator.config': {
                    prefix: 'actuator',
                    properties: {
                      port: this.options.port,
                      basePath: this.options.basePath,
                      enableHealth: this.options.enableHealth,
                      enableMetrics: this.options.enableMetrics,
                      enableInfo: this.options.enableInfo,
                      enableEnv: this.options.enableEnv,
                      enablePrometheus: this.options.enablePrometheus,
                      enableMappings: this.options.enableMappings,
                      enableBeans: this.options.enableBeans,
                      enableConfigProps: this.options.enableConfigProps,
                      enableThreadDump: this.options.enableThreadDump,
                      enableHeapDump: this.options.enableHeapDump
                    }
                  },
                  'app.feature.enabled': {
                    prefix: 'app.feature',
                    properties: {
                      enabled: true
                    }
                  },
                  'app.maxConnections': {
                    prefix: 'app',
                    properties: {
                      maxConnections: 100
                    }
                  },
                  'app.timeout': {
                    prefix: 'app',
                    properties: {
                      timeout: 30000
                    }
                  }
                }
              }
            },
            properties: this.options.customConfigProps
          };
          logger.debug({ response }, 'Configprops response structure');
          res.json(response);
        } catch (error) {
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });
    }

    // Threaddump endpoint (Node.js equivalent of Spring Boot's /actuator/threaddump)
    if (this.options.enableThreadDump) {
      this.app.get(`${this.basePath}/threaddump`, async (_req: Request, res: Response) => {
        try {
          if (!this.threadDumpCollector) {
            return res.status(500).json({ 
              error: 'Thread dump collector not initialized' 
            });
          }

          // Collect comprehensive thread dump with retry logic
          const threadDump = await this.executeWithRetry(
            () => this.threadDumpCollector!.collectThreadDump(),
            'Thread dump collection'
          );
          
          logger.debug({ 
            totalThreads: threadDump.summary.totalThreads,
            activeRequests: threadDump.summary.activeRequests 
          }, 'Thread dump collected successfully');
          
          return res.json(threadDump);
        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Thread dump collection failed after all retries');
          
          return res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Thread dump collection failed after multiple attempts'
          });
        }
      });
    }

    // Heapdump endpoint (Node.js equivalent of Spring Boot's /actuator/heapdump)
    if (this.options.enableHeapDump) {
      this.app.get(`${this.basePath}/heapdump`, async (req: Request, res: Response) => {
        try {
          if (!this.heapDumpGenerator) {
            return res.status(500).json({ 
              error: 'Heap dump generator not initialized' 
            });
          }

          // Generate heap dump with retry logic
          const result = await this.executeWithRetry(
            () => this.heapDumpGenerator!.generateHeapDump(),
            'Heap dump generation'
          );
          
          if (result.success) {
            // Return success response with file information
            return res.json({
              success: true,
              message: 'Heap dump generated successfully',
              filePath: result.filePath,
              metadata: result.metadata,
              downloadUrl: `${req.protocol}://${req.get('host')}${this.basePath}/heapdump/download?file=${encodeURIComponent(result.filePath!)}`
            });
          } else {
            return res.status(500).json({
              success: false,
              error: result.error,
              metadata: result.metadata
            });
          }
        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Heap dump generation failed after all retries');
          
          return res.status(500).json({ 
            success: false,
            error: error instanceof Error ? error.message : 'Heap dump generation failed after multiple attempts'
          });
        }
      });

      // POST heapdump endpoint (for test compatibility)
      this.app.post(`${this.basePath}/heapdump`, async (_req: Request, res: Response) => {
        try {
          if (!this.heapDumpGenerator) {
            return res.status(500).json({ 
              error: 'Heap dump generator not initialized' 
            });
          }

          // Generate heap dump with retry logic
          const result = await this.executeWithRetry(
            () => this.heapDumpGenerator!.generateHeapDump(),
            'Heap dump generation'
          );
          
          if (result.success) {
            // Return success response with file information
            return res.json({
              success: true,
              message: 'Heap dump generated successfully',
              filePath: result.filePath,
              metadata: result.metadata
            });
          } else {
            return res.status(500).json({
              success: false,
              error: result.error,
              metadata: result.metadata
            });
          }
        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Heap dump generation failed after all retries');
          
          return res.status(500).json({ 
            success: false,
            error: error instanceof Error ? error.message : 'Heap dump generation failed after multiple attempts'
          });
        }
      });

      // Heap dump download endpoint
      this.app.get(`${this.basePath}/heapdump/download`, (req: Request, res: Response) => {
        try {
          const filePath = req.query['file'] as string;
          
          if (!filePath) {
            return res.status(400).json({ error: 'File path parameter is required' });
          }

          // Security check: ensure file is within heapdump directory
          const path = require('path');
          const fs = require('fs');
          
          const normalizedFilePath = path.resolve(filePath);
          const heapDumpDir = path.resolve(this.heapDumpGenerator?.getOutputDir() || './heapdumps');
          
          if (!normalizedFilePath.startsWith(heapDumpDir)) {
            return res.status(403).json({ error: 'Access denied' });
          }

          if (!fs.existsSync(normalizedFilePath)) {
            return res.status(404).json({ error: 'Heap dump file not found' });
          }

          // Set headers for file download
          const fileName = path.basename(normalizedFilePath);
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          res.setHeader('Content-Type', 'application/octet-stream');
          
          // Stream the file
          const fileStream = fs.createReadStream(normalizedFilePath);
          fileStream.pipe(res);
          
          // Return undefined to satisfy TypeScript (the response is handled by the stream)
          return;
          
        } catch (error) {
          return res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });

      // Heap dump statistics endpoint
      this.app.get(`${this.basePath}/heapdump/stats`, (_req: Request, res: Response) => {
        try {
          if (!this.heapDumpGenerator) {
            return res.status(500).json({ 
              error: 'Heap dump generator not initialized' 
            });
          }

          const stats = this.heapDumpGenerator.getHeapDumpStats();
          return res.json(stats);
        } catch (error) {
          return res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });
    }

    // Root actuator endpoint
    this.app.get(this.basePath, (_req: Request, res: Response) => {
      const endpoints = {
        _links: {
          self: { href: this.basePath },
          health: this.options.enableHealth ? { href: `${this.basePath}/health` } : undefined,
          metrics: this.options.enableMetrics ? { href: `${this.basePath}/metrics` } : undefined,
          prometheus: this.options.enablePrometheus ? { href: `${this.basePath}/prometheus` } : undefined,
          info: this.options.enableInfo ? { href: `${this.basePath}/info` } : undefined,
          env: this.options.enableEnv ? { href: `${this.basePath}/env` } : undefined,
          mappings: this.options.enableMappings ? { href: `${this.basePath}/mappings` } : undefined,
          modules: this.options.enableBeans ? { href: `${this.basePath}/modules` } : undefined,
          configprops: this.options.enableConfigProps ? { href: `${this.basePath}/configprops` } : undefined,
          threaddump: this.options.enableThreadDump ? { href: `${this.basePath}/threaddump` } : undefined,
          heapdump: this.options.enableHeapDump ? { href: `${this.basePath}/heapdump` } : undefined,
          'heapdump-download': this.options.enableHeapDump ? { href: `${this.basePath}/heapdump/download` } : undefined,
          'heapdump-stats': this.options.enableHeapDump ? { href: `${this.basePath}/heapdump/stats` } : undefined
        }
      };
      
      // Remove undefined endpoints
      Object.keys(endpoints._links).forEach(key => {
        if (endpoints._links[key as keyof typeof endpoints._links] === undefined) {
          delete endpoints._links[key as keyof typeof endpoints._links];
        }
      });

      logger.debug('Root endpoint accessed');
      res.json(endpoints);
    });

    // Catch-all route for disabled endpoints - return 404 with error message
    this.app.get(`${this.basePath}/*`, (req: Request, res: Response) => {
      logger.warn({ 
        path: req.path, 
        method: req.method 
      }, 'Endpoint not found or disabled');
      
      res.status(404).json({ 
        error: 'Endpoint not found or disabled',
        message: 'The requested actuator endpoint is not available or has been disabled',
        path: this.basePath
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handling middleware (must be last)
    this.app.use(ErrorHandler.handleError);
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const server = this.app.listen(this.port, () => {
          logger.info({ 
            port: this.port,
            endpoints: {
              health: `http://localhost:${this.port}${this.basePath}/health`,
              metrics: `http://localhost:${this.port}${this.basePath}/metrics`,
              prometheus: `http://localhost:${this.port}${this.basePath}/prometheus`,
              info: `http://localhost:${this.port}${this.basePath}/info`,
              env: `http://localhost:${this.port}${this.basePath}/env`
            }
          }, '🚀 Node Actuator Lite started successfully');
          resolve();
        });

        // Handle server errors
        server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            logger.error({ port: this.port }, 'Port is already in use');
            reject(new Error(`Port ${this.port} is already in use`));
          } else if (error.code === 'EACCES') {
            logger.error({ port: this.port }, 'Permission denied to bind to port');
            reject(new Error(`Permission denied to bind to port ${this.port}`));
          } else {
            logger.error({ error: error.message, code: error.code }, 'Server startup error');
            reject(error);
          }
        });

        // Store server reference for shutdown
        this.server = server;
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to start actuator');
        reject(error);
      }
    });
  }

  public getApp(): Express {
    return this.app;
  }

  public getPort(): number {
    return this.port;
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
          throw new Error(`Unknown metric type: ${type}`);
      }
      if (prometheusMetric) {
        this.customMetrics.set(name, prometheusMetric);
      }
      return prometheusMetric;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to add custom metric');
      throw error; // Re-throw the error instead of returning undefined
    }
  }

  public getCustomMetric(name: string): any {
    return this.customMetrics.get(name);
  }

  // Heap Dump API Methods
  public async generateHeapDump(): Promise<any> {
    if (!this.heapDumpGenerator) {
      throw new Error('Heap dump generator not initialized. Enable heap dump in options.');
    }
    return await this.heapDumpGenerator.generateHeapDump();
  }

  public getHeapDumpStats(): any {
    if (!this.heapDumpGenerator) {
      throw new Error('Heap dump generator not initialized. Enable heap dump in options.');
    }
    return this.heapDumpGenerator.getHeapDumpStats();
  }

  public cleanupOldHeapDumps(maxAge?: number): void {
    if (this.heapDumpGenerator) {
      this.heapDumpGenerator.cleanupOldDumps(maxAge);
    }
  }

  public registerRoute(method: string, path: string, handler: string): void {
    this.routes.push({ method, path, handler });
  }

  // Add graceful shutdown support
  public async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      logger.info('🛑 Shutting down Node Actuator Lite...');
      
      try {
        // Cleanup thread dump collector
        if (this.threadDumpCollector) {
          this.threadDumpCollector.destroy();
        }
        
        // Close server if running
        if (this.server) {
          this.server.close((err?: Error) => {
            if (err) {
              logger.warn({ error: err.message }, 'Error during server shutdown');
            }
            

            
            // Reset Prometheus metrics if needed
            if (this.options.enablePrometheus) {
              try {
                const { register } = require('prom-client');
                register.clear();
              } catch (error) {
                logger.warn({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to clear Prometheus metrics');
              }
            }
            
            logger.info('✅ Node Actuator Lite shutdown completed');
            resolve();
          });
        } else {

          
          // Reset Prometheus metrics if needed
          if (this.options.enablePrometheus) {
            try {
              const { register } = require('prom-client');
              register.clear();
            } catch (error) {
              logger.warn({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to clear Prometheus metrics');
            }
          }
          
          logger.info('✅ Node Actuator Lite shutdown completed');
          resolve();
        }
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error during shutdown');
        resolve();
      }
    });
  }

  // Static method for testing - reset default metrics initialization flag
  public static resetDefaultMetricsFlag(): void {
    Actuator.defaultMetricsInitialized = false;
    Actuator.httpMetricsInitialized = false;
  }



  /**
   * Helper method to execute a function with retry logic
   * @param operation The async operation to retry
   * @param operationName Name of the operation for logging
   * @returns Promise with the result of the operation
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>, 
    operationName: string
  ): Promise<T> {
    const maxRetries = this.options.retryOptions?.maxRetries ?? 3;
    let retryDelay = this.options.retryOptions?.retryDelay ?? 100;
    const exponentialBackoff = this.options.retryOptions?.exponentialBackoff ?? true;
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          logger.debug(`${operationName} succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn({ 
          attempt, 
          maxRetries, 
          error: lastError.message 
        }, `${operationName} attempt ${attempt} failed`);
        
        // If this is the last attempt, don't wait
        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          if (exponentialBackoff) {
            retryDelay = Math.min(retryDelay * 2, 1000); // Exponential backoff, max 1 second
          }
        }
      }
    }
    
    // All retries failed
    logger.error({ 
      error: lastError?.message || 'Unknown error',
      attempts: maxRetries 
    }, `${operationName} failed after all retries`);
    
    throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
  }
} 
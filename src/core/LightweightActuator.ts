import { LightweightServer, Request, Response } from './LightweightServer';
import { register, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';
import { HealthChecker } from '../health/HealthChecker';
import { MetricsCollector } from '../metrics/MetricsCollector';
import { InfoCollector } from '../info/InfoCollector';
import { EnvironmentCollector } from '../env/EnvironmentCollector';
import logger from '../utils/logger';
import { validateConfig, ValidatedActuatorOptions } from '../utils/config';

export interface LightweightActuatorOptions {
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

export class LightweightActuator {
  private server: LightweightServer;
  private port: number;
  private basePath: string;
  private healthChecker: HealthChecker;
  private metricsCollector: MetricsCollector;
  private infoCollector: InfoCollector;
  private envCollector: EnvironmentCollector;
  private options: ValidatedActuatorOptions;
  private customMetrics: Map<string, any> = new Map();

  // Default Prometheus metrics
  private httpRequestsTotal!: Counter;
  private httpRequestDuration!: Histogram;

  // Static properties for metrics
  private static defaultMetricsInitialized = false;
  private static httpMetricsInitialized = false;
  private static httpRequestsTotal: Counter;
  private static httpRequestDuration: Histogram;

  constructor(options: LightweightActuatorOptions = {}) {
    // Validate configuration
    const validatedOptions = validateConfig({
      port: 0,
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

    // Initialize lightweight server
    this.server = new LightweightServer(this.port, this.basePath);

    // Initialize collectors
    this.healthChecker = new HealthChecker(
      this.options.customHealthChecks,
      this.options.healthOptions
    );
    this.metricsCollector = new MetricsCollector();
    this.infoCollector = new InfoCollector();
    this.envCollector = new EnvironmentCollector();

    // Initialize Prometheus metrics
    if (this.options.enablePrometheus) {
      this.initializePrometheusMetrics();
    }

    // Setup routes
    this.setupRoutes();

    logger.info('Lightweight Actuator initialized', { 
      port: this.port, 
      basePath: this.basePath,
      features: {
        health: this.options.enableHealth,
        metrics: this.options.enableMetrics,
        prometheus: this.options.enablePrometheus
      }
    });
  }

  private initializePrometheusMetrics(): void {
    // Collect default metrics only once
    if (!LightweightActuator.defaultMetricsInitialized) {
      try {
        collectDefaultMetrics({ register });
        LightweightActuator.defaultMetricsInitialized = true;
        logger.info('Default Prometheus metrics initialized');
      } catch (error) {
        logger.warn('Default metrics already registered, skipping...');
      }
    }

    // Initialize HTTP metrics only once
    if (!LightweightActuator.httpMetricsInitialized) {
      try {
        LightweightActuator.httpRequestsTotal = new Counter({
          name: 'http_requests_total',
          help: 'Total number of HTTP requests',
          labelNames: ['method', 'route', 'status_code']
        });

        LightweightActuator.httpRequestDuration = new Histogram({
          name: 'http_request_duration_seconds',
          help: 'HTTP request duration in seconds',
          labelNames: ['method', 'route']
        });

        LightweightActuator.httpMetricsInitialized = true;
        logger.info('HTTP Prometheus metrics initialized');
      } catch (error) {
        logger.warn('HTTP metrics already registered, skipping...');
      }
    }

    // Assign static metrics to instance
    this.httpRequestsTotal = LightweightActuator.httpRequestsTotal;
    this.httpRequestDuration = LightweightActuator.httpRequestDuration;

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
        logger.debug('Custom metric registered', { metric: metric.name, type: metric.type });
      } catch (error) {
        logger.error('Failed to register custom metric', { 
          metric: metric.name, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });
  }

  private setupRoutes(): void {
    // Health endpoint
    if (this.options.enableHealth) {
      this.server.get('/health', async (_req: Request, res: Response) => {
        const start = Date.now();
        
        try {
          const health = await this.healthChecker.check();
          
          if (this.options.enablePrometheus) {
            this.httpRequestsTotal.inc({ 
              method: 'GET', 
              route: '/health', 
              status_code: 200 
            });
            this.httpRequestDuration.observe({ method: 'GET', route: '/health' }, (Date.now() - start) / 1000);
          }
          
          res.status(200).json(health);
        } catch (error) {
          logger.error('Health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
          res.status(500).json({ 
            status: 'DOWN', 
            error: 'Health check failed',
            timestamp: new Date().toISOString()
          });
        }
      });
    }

    // Metrics endpoint
    if (this.options.enableMetrics) {
      this.server.get('/metrics', async (_req: Request, res: Response) => {
        try {
          const metrics = await this.metricsCollector.collect();
          res.status(200).json(metrics);
        } catch (error) {
          logger.error('Metrics collection failed', { error: error instanceof Error ? error.message : 'Unknown error' });
          res.status(500).json({ error: 'Metrics collection failed' });
        }
      });
    }

    // Prometheus endpoint
    if (this.options.enablePrometheus) {
      this.server.get('/prometheus', async (_req: Request, res: Response) => {
        try {
          res.setHeader('Content-Type', 'text/plain');
          const metrics = await register.metrics();
          res.send(metrics);
        } catch (error) {
          logger.error('Prometheus metrics failed', { error: error instanceof Error ? error.message : 'Unknown error' });
          res.status(500).json({ error: 'Prometheus metrics failed' });
        }
      });
    }

    // Info endpoint
    if (this.options.enableInfo) {
      this.server.get('/info', async (_req: Request, res: Response) => {
        try {
          const info = await this.infoCollector.collect();
          res.status(200).json(info);
        } catch (error) {
          logger.error('Info collection failed', { error: error instanceof Error ? error.message : 'Unknown error' });
          res.status(500).json({ error: 'Info collection failed' });
        }
      });
    }

    // Environment endpoint
    if (this.options.enableEnv) {
      this.server.get('/env', async (_req: Request, res: Response) => {
        try {
          const env = await this.envCollector.collect();
          res.status(200).json(env);
        } catch (error) {
          logger.error('Environment collection failed', { error: error instanceof Error ? error.message : 'Unknown error' });
          res.status(500).json({ error: 'Environment collection failed' });
        }
      });
    }

    // Thread dump endpoint
    if (this.options.enableThreadDump) {
      this.server.get('/threaddump', async (_req: Request, res: Response) => {
        try {
          const threadDump = this.generateThreadDump();
          res.status(200).json(threadDump);
        } catch (error) {
          logger.error('Thread dump generation failed', { error: error instanceof Error ? error.message : 'Unknown error' });
          res.status(500).json({ error: 'Thread dump generation failed' });
        }
      });
    }

    // Heap dump endpoint
    if (this.options.enableHeapDump) {
      this.server.get('/heapdump', async (_req: Request, res: Response) => {
        try {
          const heapDump = await this.generateHeapDump();
          res.status(200).json(heapDump);
        } catch (error) {
          logger.error('Heap dump generation failed', { error: error instanceof Error ? error.message : 'Unknown error' });
          res.status(500).json({ error: 'Heap dump generation failed' });
        }
      });
    }
  }

  public async start(): Promise<number> {
    try {
      const port = await this.server.start();
      logger.info('🚀 Lightweight Actuator started successfully', { 
        port, 
        endpoints: {
          health: `http://localhost:${port}${this.basePath}/health`,
          metrics: `http://localhost:${port}${this.basePath}/metrics`,
          prometheus: `http://localhost:${port}${this.basePath}/prometheus`,
          info: `http://localhost:${port}${this.basePath}/info`,
          env: `http://localhost:${port}${this.basePath}/env`,
          threaddump: `http://localhost:${port}${this.basePath}/threaddump`,
          heapdump: `http://localhost:${port}${this.basePath}/heapdump`
        }
      });
      return port;
    } catch (error) {
      logger.error('Failed to start Lightweight Actuator', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      await this.server.stop();
      logger.info('✅ Lightweight Actuator shutdown completed');
    } catch (error) {
      logger.error('Error during shutdown', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  public getPort(): number {
    return this.server.getPort();
  }

  public getBasePath(): string {
    return this.basePath;
  }

  public getCustomMetric(name: string): any {
    return this.customMetrics.get(name);
  }

  private generateThreadDump(): any {
    try {
      const v8 = require('v8');
      const os = require('os');
      const asyncHooks = require('async_hooks');
      const workerThreads = require('worker_threads');

      return {
        timestamp: new Date().toISOString(),
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        uptime: process.uptime(),
        mainThread: {
          id: 'main',
          name: 'Main Event Loop Thread',
          state: 'RUNNING',
          type: 'Event Loop Thread',
          description: 'Primary Node.js event loop thread handling all I/O operations',
          stack: [
            'Node.js Event Loop (libuv)',
            'HTTP Server Handler',
            'Request Processing',
            'Async Operation Queue'
          ],
          capabilities: [
            'I/O Operations',
            'Timer Management',
            'Event Handling',
            'Promise Resolution',
            'Async/Await Processing'
          ]
        },
        eventLoop: {
          type: 'Single-threaded Event Loop',
          engine: 'libuv',
          phases: [
            'Timers',
            'Pending callbacks',
            'Idle, prepare',
            'Poll',
            'Check',
            'Close callbacks'
          ],
          currentPhase: 'Poll',
          heapStatistics: v8.getHeapStatistics(),
          heapSpaceStatistics: v8.getHeapSpaceStatistics(),
          cpuUsage: process.cpuUsage(),
          resourceUsage: process.resourceUsage ? process.resourceUsage() : 'Not available',
          platform: os.platform(),
          cpus: os.cpus().length,
          loadAverage: os.loadavg()
        },
        asyncOperations: {
          asyncHookEnabled: asyncHooks.asyncHookEnabled || false,
          executionAsyncId: asyncHooks.executionAsyncId ? asyncHooks.executionAsyncId() : 'Not available',
          triggerAsyncId: asyncHooks.triggerAsyncId ? asyncHooks.triggerAsyncId() : 'Not available',
          types: [
            'HTTP/HTTPS requests',
            'File system operations',
            'Database queries',
            'Network operations',
            'Timer operations',
            'Promise operations',
            'Stream operations'
          ]
        },
        workerThreads: {
          isMainThread: workerThreads.isMainThread,
          workerCount: 0,
          threadId: workerThreads.threadId,
          description: workerThreads.isMainThread ? 'Running on main event loop thread' : 'Running on worker thread'
        },
        activeHandles: this.getActiveHandles(),
        activeRequests: this.getActiveRequests(),
        processInfo: {
          pid: process.pid,
          ppid: process.ppid,
          uid: process.getuid ? process.getuid() : 'Not available',
          gid: process.getgid ? process.getgid() : 'Not available',
          title: process.title,
          version: process.version,
          arch: process.arch,
          platform: process.platform,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        },
        memoryInfo: {
          processMemory: process.memoryUsage(),
          systemMemory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem(),
            usagePercentage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%'
          },
          v8Heap: v8.getHeapStatistics(),
          v8HeapSpaces: v8.getHeapSpaceStatistics()
        },
        cpuInfo: {
          cpus: os.cpus().length,
          loadAverage: os.loadavg(),
          cpuUsage: process.cpuUsage(),
          architecture: os.arch(),
          platform: os.platform()
        },
        note: 'Detailed Node.js event loop and async operation analysis. Node.js uses a single-threaded event loop with libuv for async operations.'
      };
    } catch (error) {
      logger.error('Thread dump generation failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        error: 'Thread dump generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        pid: process.pid
      };
    }
  }

  private async generateHeapDump(): Promise<any> {
    const startTime = Date.now();
    
    try {
      const fs = require('fs');
      const path = require('path');
      const { v4: uuidv4 } = require('uuid');

      // Create heapdumps directory if it doesn't exist
      const outputDir = this.options.heapDumpOptions?.outputDir || './heapdumps';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate filename with timestamp and unique ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const uniqueId = uuidv4().substring(0, 8);
      const filename = `heapdump-${timestamp}-${uniqueId}.heapsnapshot`;
      const filePath = path.join(outputDir, filename);

      // Try to use V8's built-in heap snapshot (Node.js 12+)
      if (typeof (global as any).v8?.writeHeapSnapshot === 'function') {
        return await this.generateV8HeapDump(filePath, startTime);
      } else {
        return this.generateFallbackHeapDump(filePath, startTime);
      }
    } catch (error) {
      logger.error('Heap dump generation failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        error: 'Heap dump generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        pid: process.pid
      };
    }
  }

  private async generateV8HeapDump(filePath: string, startTime: number): Promise<any> {
    return new Promise((resolve) => {
      try {
        const v8 = require('v8');
        const fs = require('fs');
        
        // Configure V8 heap dump options
        const heapSnapshotOptions = {
          exposeInternals: true,
          exposeNumericValues: true,
          captureNumericValue: true
        };

        // Write heap snapshot
        const stream = v8.writeHeapSnapshot(filePath, heapSnapshotOptions);
        
        stream.on('finish', () => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Get file size
          const stats = fs.statSync(filePath);
          
          const response = {
            success: true,
            message: 'Heap dump generated successfully using V8 writeHeapSnapshot',
            filePath: filePath,
            fileSize: stats.size,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
            pid: process.pid,
            memoryUsage: process.memoryUsage(),
            note: 'Full heap snapshot saved to file. Use Chrome DevTools or other heap analyzers to analyze.'
          };

          resolve(response);
        });

        stream.on('error', (error: Error) => {
          logger.error('V8 heap dump error', { error: error.message });
          resolve(this.generateFallbackHeapDump(filePath, startTime));
        });
      } catch (error) {
        logger.error('V8 heap dump failed, falling back', { error: error instanceof Error ? error.message : 'Unknown error' });
        resolve(this.generateFallbackHeapDump(filePath, startTime));
      }
    });
  }

  private generateFallbackHeapDump(filePath: string, startTime: number): any {
    try {
      const v8 = require('v8');
      const os = require('os');
      const fs = require('fs');
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Generate comprehensive memory analysis
      const heapDump = {
        success: true,
        message: 'Comprehensive memory analysis generated',
        filePath: filePath,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        pid: process.pid,
        metadata: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          uptime: process.uptime()
        },
        memoryUsage: {
          ...process.memoryUsage(),
          heapUsedPercentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100).toFixed(2) + '%',
          externalPercentage: (process.memoryUsage().external / process.memoryUsage().heapTotal * 100).toFixed(2) + '%'
        },
        gc: {
          heapSpaceStatistics: v8.getHeapSpaceStatistics(),
          heapStatistics: v8.getHeapStatistics()
        },
        modules: this.getLoadedModules(),
        activeHandles: this.getActiveHandles(),
        activeRequests: this.getActiveRequests(),
        systemInfo: {
          hostname: os.hostname(),
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          uptime: os.uptime()
        },
        note: 'This is a comprehensive memory analysis. For detailed heap snapshots, ensure Node.js version 12+ is used.'
      };

      // Write to file
      fs.writeFileSync(filePath, JSON.stringify(heapDump, null, 2));
      
      // Get file size
      const stats = fs.statSync(filePath);

      return {
        ...heapDump,
        fileSize: stats.size
      };
    } catch (error) {
      logger.error('Fallback heap dump error', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        error: 'Fallback heap dump failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        pid: process.pid
      };
    }
  }

  private getActiveHandles(): any {
    try {
      return {
        count: (process as any)._getActiveHandles ? (process as any)._getActiveHandles().length : 'Not available',
        types: (process as any)._getActiveHandles ? 
          (process as any)._getActiveHandles().map((handle: any) => handle.constructor.name) : 
          'Not available'
      };
    } catch (error) {
      return { error: 'Active handles information not available' };
    }
  }

  private getActiveRequests(): any {
    try {
      return {
        count: (process as any)._getActiveRequests ? (process as any)._getActiveRequests().length : 'Not available',
        types: (process as any)._getActiveRequests ? 
          (process as any)._getActiveRequests().map((req: any) => req.constructor.name) : 
          'Not available'
      };
    } catch (error) {
      return { error: 'Active requests information not available' };
    }
  }

  private getLoadedModules(): any {
    try {
      return Object.keys(require.cache).map(modulePath => ({
        path: modulePath,
        loaded: true
      }));
    } catch (error) {
      return { error: 'Module information not available' };
    }
  }

  // Static method for testing - reset default metrics initialization flag
  public static resetDefaultMetricsFlag(): void {
    LightweightActuator.defaultMetricsInitialized = false;
    LightweightActuator.httpMetricsInitialized = false;
  }
}

import os from 'os';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

export interface MetricsData {
  timestamp: string;
  system: SystemMetrics;
  process: ProcessMetrics;
  memory: MemoryMetrics;
  cpu: CpuMetrics;
  uptime: number;
}

export interface FormattedMetricsData {
  timestamp: string;
  uptime: string;
  system: {
    hostname: string;
    platform: string;
    arch: string;
    nodeVersion: string;
    totalMemory: string;
    freeMemory: string;
    loadAverage: string[];
    cpuCount: number;
    uptime: number;
  };
  process: {
    pid: number;
    uptime: string;
    version: string;
    memoryUsage: {
      rss: string;
      heapTotal: string;
      heapUsed: string;
      external: string;
    };
    cpuUsage: {
      user: string;
      system: string;
    };
  };
  memory: {
    total: string;
    used: string;
    free: string;
    usagePercentage: string;
    processRss: string;
    processHeapTotal: string;
    processHeapUsed: string;
    processExternal: string;
  };
  cpu: {
    loadAverage: string[];
    cpuCount: number;
    loadPercentage: string;
    processCpuUser: string;
    processCpuSystem: string;
  };
}

export interface SystemMetrics {
  hostname: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  totalMemory: number;
  freeMemory: number;
  loadAverage: number[];
  cpuCount: number;
  uptime: number;
}

export interface ProcessMetrics {
  pid: number;
  uptime: number;
  version: string;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
}

export interface MemoryMetrics {
  total: number;
  used: number;
  free: number;
  usagePercentage: number;
  processRss: number;
  processHeapTotal: number;
  processHeapUsed: number;
  processExternal: number;
}

export interface CpuMetrics {
  loadAverage: number[];
  cpuCount: number;
  loadPercentage: number;
  processCpuUser: number;
  processCpuSystem: number;
}

export class MetricsCollector {
  private lastCpuUsage: { user: number; system: number } | null = null;
  private customMetrics: Map<string, Counter | Gauge | Histogram> = new Map();
  private registry: Registry;

  constructor() {
    // Initialize CPU usage tracking
    this.lastCpuUsage = process.cpuUsage();
    this.registry = new Registry();
  }

  public async collect(): Promise<MetricsData> {
    const systemMetrics = this.collectSystemMetrics();
    const processMetrics = this.collectProcessMetrics();
    const memoryMetrics = this.collectMemoryMetrics();
    const cpuMetrics = this.collectCpuMetrics();

    return {
      timestamp: new Date().toISOString(),
      system: systemMetrics,
      process: processMetrics,
      memory: memoryMetrics,
      cpu: cpuMetrics,
      uptime: process.uptime()
    };
  }

  public async getFormattedMetrics(): Promise<FormattedMetricsData> {
    const metrics = await this.collect();
    
    return {
      timestamp: metrics.timestamp,
      uptime: `${metrics.uptime.toFixed(2)}s`,
      system: {
        hostname: metrics.system.hostname,
        platform: metrics.system.platform,
        arch: metrics.system.arch,
        nodeVersion: metrics.system.nodeVersion,
        totalMemory: `${(metrics.system.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        freeMemory: `${(metrics.system.freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        loadAverage: metrics.system.loadAverage.map(load => load.toFixed(2)),
        cpuCount: metrics.system.cpuCount,
        uptime: metrics.system.uptime
      },
      process: {
        pid: metrics.process.pid,
        uptime: `${metrics.process.uptime.toFixed(2)}s`,
        version: metrics.process.version,
        memoryUsage: {
          rss: `${(metrics.process.memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(metrics.process.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          heapUsed: `${(metrics.process.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          external: `${(metrics.process.memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
        },
        cpuUsage: {
          user: `${(metrics.process.cpuUsage.user / 1000000).toFixed(2)}s`,
          system: `${(metrics.process.cpuUsage.system / 1000000).toFixed(2)}s`
        }
      },
      memory: {
        total: `${(metrics.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB`,
        used: `${(metrics.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB`,
        free: `${(metrics.memory.free / 1024 / 1024 / 1024).toFixed(2)} GB`,
        usagePercentage: `${metrics.memory.usagePercentage.toFixed(2)}%`,
        processRss: `${(metrics.memory.processRss / 1024 / 1024).toFixed(2)} MB`,
        processHeapTotal: `${(metrics.memory.processHeapTotal / 1024 / 1024).toFixed(2)} MB`,
        processHeapUsed: `${(metrics.memory.processHeapUsed / 1024 / 1024).toFixed(2)} MB`,
        processExternal: `${(metrics.memory.processExternal / 1024 / 1024).toFixed(2)} MB`
      },
      cpu: {
        loadAverage: metrics.cpu.loadAverage.map(load => load.toFixed(2)),
        cpuCount: metrics.cpu.cpuCount,
        loadPercentage: `${metrics.cpu.loadPercentage.toFixed(2)}%`,
        processCpuUser: `${metrics.cpu.processCpuUser.toFixed(2)}s`,
        processCpuSystem: `${metrics.cpu.processCpuSystem.toFixed(2)}s`
      }
    };
  }

  public addCustomMetric(
    name: string,
    help: string,
    type: 'counter' | 'gauge' | 'histogram',
    options: { labelNames?: string[] } = {}
  ): Counter | Gauge | Histogram {
    const metricOptions = {
      name,
      help,
      labelNames: options.labelNames || [],
      registers: [this.registry]
    };

    let metric: Counter | Gauge | Histogram;

    switch (type) {
      case 'counter':
        metric = new Counter(metricOptions);
        break;
      case 'gauge':
        metric = new Gauge(metricOptions);
        break;
      case 'histogram':
        metric = new Histogram(metricOptions);
        break;
      default:
        throw new Error(`Unknown metric type: ${type}`);
    }

    this.customMetrics.set(name, metric);
    return metric;
  }

  public getCustomMetric(name: string): Counter | Gauge | Histogram | undefined {
    return this.customMetrics.get(name);
  }

  public removeCustomMetric(name: string): boolean {
    const metric = this.customMetrics.get(name);
    if (metric) {
      this.registry.removeSingleMetric(name);
      this.customMetrics.delete(name);
      return true;
    }
    return false;
  }

  public getCustomMetrics(): Map<string, Counter | Gauge | Histogram> {
    return new Map(this.customMetrics);
  }

  public getRegistry(): Registry {
    return this.registry;
  }

  private collectSystemMetrics(): SystemMetrics {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg(),
      cpuCount: os.cpus().length,
      uptime: os.uptime()
    };
  }

  private collectProcessMetrics(): ProcessMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version,
      memoryUsage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };
  }

  private collectMemoryMetrics(): MemoryMetrics {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = process.memoryUsage();

    return {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      usagePercentage: (usedMemory / totalMemory) * 100,
      processRss: memoryUsage.rss,
      processHeapTotal: memoryUsage.heapTotal,
      processHeapUsed: memoryUsage.heapUsed,
      processExternal: memoryUsage.external
    };
  }

  private collectCpuMetrics(): CpuMetrics {
    const loadAverage = os.loadavg();
    const cpuCount = os.cpus().length;
    const currentCpuUsage = process.cpuUsage();
    
    let loadPercentage = 0;
    let processCpuUser = 0;
    let processCpuSystem = 0;

    if (this.lastCpuUsage) {
      const userDiff = currentCpuUsage.user - this.lastCpuUsage.user;
      const systemDiff = currentCpuUsage.system - this.lastCpuUsage.system;
      const totalDiff = userDiff + systemDiff;
      
      // Calculate CPU percentage (rough approximation)
      loadPercentage = Math.min((totalDiff / 1000000) * 100, 100); // Convert to percentage
      processCpuUser = userDiff / 1000000; // Convert to seconds
      processCpuSystem = systemDiff / 1000000; // Convert to seconds
    }

    this.lastCpuUsage = currentCpuUsage;

    return {
      loadAverage,
      cpuCount,
      loadPercentage,
      processCpuUser,
      processCpuSystem
    };
  }

  public getSystemInfo(): SystemMetrics {
    return this.collectSystemMetrics();
  }

  public getProcessInfo(): ProcessMetrics {
    return this.collectProcessMetrics();
  }

  public getMemoryInfo(): MemoryMetrics {
    return this.collectMemoryMetrics();
  }

  public getCpuInfo(): CpuMetrics {
    return this.collectCpuMetrics();
  }
} 
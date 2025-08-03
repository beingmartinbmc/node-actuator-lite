import os from 'os';

export interface MetricsData {
  timestamp: string;
  system: SystemMetrics;
  process: ProcessMetrics;
  memory: MemoryMetrics;
  cpu: CpuMetrics;
  uptime: number;
}

export interface SystemMetrics {
  hostname: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  totalMemory: number;
  freeMemory: number;
  loadAverage: number[];
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
  constructor() {
    // Constructor implementation
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

  private collectSystemMetrics(): SystemMetrics {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg()
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
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = process.memoryUsage();

    return {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usagePercentage: (usedMem / totalMem) * 100,
      processRss: memoryUsage.rss,
      processHeapTotal: memoryUsage.heapTotal,
      processHeapUsed: memoryUsage.heapUsed,
      processExternal: memoryUsage.external
    };
  }

  private collectCpuMetrics(): CpuMetrics {
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const loadPercentage = (loadAvg[0]! / cpuCount) * 100;
    const cpuUsage = process.cpuUsage();

    return {
      loadAverage: loadAvg,
      cpuCount,
      loadPercentage,
      processCpuUser: cpuUsage.user,
      processCpuSystem: cpuUsage.system
    };
  }

  public async getFormattedMetrics(): Promise<Record<string, any>> {
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
        loadAverage: metrics.system.loadAverage.map((load: number) => load.toFixed(2))
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
        loadAverage: metrics.cpu.loadAverage.map((load: number) => load.toFixed(2)),
        cpuCount: metrics.cpu.cpuCount,
        loadPercentage: `${metrics.cpu.loadPercentage.toFixed(2)}%`,
        processCpuUser: `${(metrics.cpu.processCpuUser / 1000000).toFixed(2)}s`,
        processCpuSystem: `${(metrics.cpu.processCpuSystem / 1000000).toFixed(2)}s`
      }
    };
  }

  // Custom metrics management
  private customMetrics: Map<string, any> = new Map();

  public addCustomMetric(name: string, help: string, type: 'counter' | 'gauge' | 'histogram', options?: { labelNames?: string[] }): any {
    const { Counter, Gauge, Histogram } = require('prom-client');
    
    let metric: any;
    
    switch (type) {
      case 'counter':
        metric = new Counter({
          name,
          help,
          labelNames: options?.labelNames || []
        });
        break;
      case 'gauge':
        metric = new Gauge({
          name,
          help,
          labelNames: options?.labelNames || []
        });
        break;
      case 'histogram':
        metric = new Histogram({
          name,
          help,
          labelNames: options?.labelNames || []
        });
        break;
      default:
        throw new Error(`Unknown metric type: ${type}`);
    }
    
    this.customMetrics.set(name, metric);
    return metric;
  }

  public getCustomMetric(name: string): any {
    return this.customMetrics.get(name);
  }

  public removeCustomMetric(name: string): boolean {
    return this.customMetrics.delete(name);
  }

  public getCustomMetrics(): Map<string, any> {
    return new Map(this.customMetrics);
  }
} 
import { performance } from 'perf_hooks';
import { withTimeout } from '../utils/timeout';

export interface HealthStatus {
  status: 'UP' | 'DOWN' | 'UNKNOWN';
  details?: Record<string, any>;
  timestamp: string;
  uptime: number;
}

export interface HealthCheck {
  name: string;
  status: 'UP' | 'DOWN' | 'UNKNOWN';
  details?: Record<string, any>;
}

export interface HealthIndicator {
  name: string;
  check: () => Promise<{ status: string; details?: any }>;
  enabled?: boolean;
  critical?: boolean; // If true, this check failing will make overall status DOWN
}

export interface HealthCheckerOptions {
  includeDiskSpace?: boolean;
  includeProcess?: boolean;
  customIndicators?: HealthIndicator[];
  diskSpaceThreshold?: number; // Minimum free disk space in bytes
  diskSpacePath?: string; // Path to check disk space for
  healthCheckTimeout?: number; // Timeout for health checks in milliseconds (default: 5000)
}

export class HealthChecker {
  private customHealthChecks: Array<() => Promise<{ status: string; details?: any }>>;
  private options: HealthCheckerOptions;
  private builtInIndicators: HealthIndicator[];

  constructor(
    customHealthChecks: Array<() => Promise<{ status: string; details?: any }>> = [],
    options: HealthCheckerOptions = {}
  ) {
    this.customHealthChecks = customHealthChecks;
    this.options = {
      includeDiskSpace: true,
      includeProcess: true,
      diskSpaceThreshold: 10 * 1024 * 1024, // 10MB default threshold
      diskSpacePath: process.cwd(), // Current working directory
      healthCheckTimeout: 5000, // 5 seconds default timeout
      ...options
    };

    // Initialize built-in health indicators
    this.builtInIndicators = [
      {
        name: 'diskSpace',
        check: this.checkDiskSpaceHealth.bind(this),
        enabled: this.options.includeDiskSpace ?? true,
        critical: true
      },
      {
        name: 'process',
        check: this.checkProcessHealth.bind(this),
        enabled: this.options.includeProcess ?? true,
        critical: false
      }
    ];
  }

  public async check(): Promise<HealthStatus> {
    const startTime = performance.now();
    const checks: HealthCheck[] = [];
    const timeout = this.options.healthCheckTimeout!;

    try {
      // Run enabled built-in health indicators
      for (const indicator of this.builtInIndicators) {
        if (indicator.enabled) {
          try {
            const result = await withTimeout(
              indicator.check(),
              timeout,
              `Health check '${indicator.name}' timed out after ${timeout}ms`
            );
            checks.push({
              name: indicator.name,
              status: result.status as 'UP' | 'DOWN' | 'UNKNOWN',
              details: result.details
            });
          } catch (error) {
            checks.push({
              name: indicator.name,
              status: 'DOWN',
              details: { error: error instanceof Error ? error.message : 'Unknown error' }
            });
          }
        }
      }

      // Run custom health indicators
      if (this.options.customIndicators) {
        for (const indicator of this.options.customIndicators) {
          if (indicator.enabled !== false) {
            try {
              const result = await withTimeout(
                indicator.check(),
                timeout,
                `Health check '${indicator.name}' timed out after ${timeout}ms`
              );
              checks.push({
                name: indicator.name,
                status: result.status as 'UP' | 'DOWN' | 'UNKNOWN',
                details: result.details
              });
            } catch (error) {
              checks.push({
                name: indicator.name,
                status: 'DOWN',
                details: { error: error instanceof Error ? error.message : 'Unknown error' }
              });
            }
          }
        }
      }

      // Run legacy custom health checks
      for (let i = 0; i < this.customHealthChecks.length; i++) {
        try {
          const customCheck = await withTimeout(
            this.customHealthChecks[i]!(),
            timeout,
            `Legacy health check 'custom-${i}' timed out after ${timeout}ms`
          );
          checks.push({
            name: `custom-${i}`,
            status: customCheck.status as 'UP' | 'DOWN' | 'UNKNOWN',
            details: customCheck.details
          });
        } catch (error) {
          checks.push({
            name: `custom-${i}`,
            status: 'DOWN',
            details: { error: error instanceof Error ? error.message : 'Unknown error' }
          });
        }
      }

      // Determine overall status
      const overallStatus = this.determineOverallStatus(checks);
      const checkTime = performance.now() - startTime;

      return {
        status: overallStatus,
        details: {
          checks,
          responseTime: `${checkTime.toFixed(2)}ms`
        },
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };
    } catch (error) {
      return {
        status: 'DOWN',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };
    }
  }

  private async checkDiskSpaceHealth(): Promise<HealthCheck> {
    try {
      // Get disk space info for the specified path
      const freeSpace = this.getFreeDiskSpace(this.options.diskSpacePath!);
      
      const isHealthy = freeSpace >= this.options.diskSpaceThreshold!;
      
      return {
        name: 'diskSpace',
        status: isHealthy ? 'UP' : 'DOWN',
        details: {
          total: this.getTotalDiskSpace(this.options.diskSpacePath!),
          free: freeSpace,
          threshold: this.options.diskSpaceThreshold,
          path: this.options.diskSpacePath,
          exists: true
        }
      };
    } catch (error) {
      return {
        name: 'diskSpace',
        status: 'UNKNOWN',
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          path: this.options.diskSpacePath,
          exists: false
        }
      };
    }
  }

  private getFreeDiskSpace(path: string): number {
    try {
      const { execSync } = require('child_process');
      const os = require('os');
      
      if (os.platform() === 'win32') {
        // Windows - simplified approach
        return 1024 * 1024 * 1024; // Return 1GB as fallback
      } else {
        // Unix/Linux/macOS
        const output = execSync(`df -P "${path}" | tail -1 | awk '{print $4}'`, { encoding: 'utf8' });
        return parseInt(output.trim()) * 1024; // Convert KB to bytes
      }
    } catch (error) {
      return 1024 * 1024 * 1024; // Return 1GB as fallback
    }
  }

  private getTotalDiskSpace(path: string): number {
    try {
      const { execSync } = require('child_process');
      const os = require('os');
      
      if (os.platform() === 'win32') {
        // Windows
        return 1024 * 1024 * 1024 * 100; // Return 100GB as fallback
      } else {
        // Unix/Linux/macOS
        const output = execSync(`df -P "${path}" | tail -1 | awk '{print $2}'`, { encoding: 'utf8' });
        return parseInt(output.trim()) * 1024; // Convert KB to bytes
      }
    } catch (error) {
      return 1024 * 1024 * 1024 * 100; // Return 100GB as fallback
    }
  }



  private async checkProcessHealth(): Promise<HealthCheck> {
    try {
      const processMemory = process.memoryUsage();
      const processCpu = process.cpuUsage();

      return {
        name: 'process',
        status: 'UP',
        details: {
          pid: process.pid,
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          memory: {
            rss: `${(processMemory.rss / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(processMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
            heapUsed: `${(processMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            external: `${(processMemory.external / 1024 / 1024).toFixed(2)} MB`
          },
          cpu: {
            user: `${(processCpu.user / 1000000).toFixed(2)}s`,
            system: `${(processCpu.system / 1000000).toFixed(2)}s`
          }
        }
      };
    } catch (error) {
      return {
        name: 'process',
        status: 'UNKNOWN',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private determineOverallStatus(checks: HealthCheck[]): 'UP' | 'DOWN' | 'UNKNOWN' {
    if (checks.length === 0) {
      return 'UNKNOWN';
    }

    // Get the list of critical indicators from the configuration
    const criticalIndicators = this.getCriticalIndicators();
    
    // Check if any critical indicators are DOWN
    const criticalDown = checks.some(check => 
      criticalIndicators.includes(check.name) && check.status === 'DOWN'
    );

    if (criticalDown) {
      return 'DOWN';
    }

    // If no critical checks are DOWN, check if we have any UP checks
    const hasUp = checks.some(check => check.status === 'UP');
    const hasDown = checks.some(check => check.status === 'DOWN');
    const hasUnknown = checks.some(check => check.status === 'UNKNOWN');

    if (hasUp) {
      return 'UP'; // If any check is UP and no critical checks are DOWN, overall status is UP
    } else if (hasDown) {
      return 'DOWN'; // If no UP checks but some DOWN checks (and none are critical), still DOWN
    } else if (hasUnknown) {
      return 'UNKNOWN'; // If only UNKNOWN checks
    } else {
      return 'UNKNOWN'; // Fallback
    }
  }

  private getCriticalIndicators(): string[] {
    const critical: string[] = [];
    
    // Add built-in critical indicators
    this.builtInIndicators.forEach(indicator => {
      if (indicator.critical && indicator.enabled) {
        critical.push(indicator.name);
      }
    });
    
    // Add custom critical indicators
    if (this.options.customIndicators) {
      this.options.customIndicators.forEach(indicator => {
        if (indicator.critical && indicator.enabled !== false) {
          critical.push(indicator.name);
        }
      });
    }
    
    return critical;
  }

  public addHealthCheck(healthCheck: () => Promise<{ status: string; details?: any }>): void {
    this.customHealthChecks.push(healthCheck);
  }

  public addHealthIndicator(indicator: HealthIndicator): void {
    if (!this.options.customIndicators) {
      this.options.customIndicators = [];
    }
    this.options.customIndicators.push(indicator);
  }

  public updateOptions(options: Partial<HealthCheckerOptions>): void {
    this.options = { ...this.options, ...options };
    
    // Update built-in indicators
    this.builtInIndicators.forEach(indicator => {
      switch (indicator.name) {
        case 'diskSpace':
          indicator.enabled = this.options.includeDiskSpace ?? true;
          break;
        case 'process':
          indicator.enabled = this.options.includeProcess ?? true;
          break;
      }
    });
  }

  public getOptions(): HealthCheckerOptions {
    return { ...this.options };
  }

  public removeHealthIndicator(name: string): void {
    if (this.options.customIndicators) {
      this.options.customIndicators = this.options.customIndicators.filter(
        indicator => indicator.name !== name
      );
    }
  }

  public getHealthIndicators(): Array<{ name: string; enabled: boolean; critical: boolean }> {
    const indicators: Array<{ name: string; enabled: boolean; critical: boolean }> = [];
    
    // Add built-in indicators
    this.builtInIndicators.forEach(indicator => {
      indicators.push({
        name: indicator.name,
        enabled: indicator.enabled ?? true,
        critical: indicator.critical ?? false
      });
    });
    
    // Add custom indicators
    if (this.options.customIndicators) {
      this.options.customIndicators.forEach(indicator => {
        indicators.push({
          name: indicator.name,
          enabled: indicator.enabled ?? true,
          critical: indicator.critical ?? false
        });
      });
    }
    
    return indicators;
  }
} 
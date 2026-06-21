import fs from 'fs';
import { logger } from '../utils/logger';
import type {
  HealthStatus,
  HealthIndicatorRegistration,
  HealthIndicatorResult,
  HealthResponse,
  HealthComponentResponse,
  ResolvedActuatorOptions,
} from '../core/types';

interface InternalIndicator {
  name: string;
  check: () => Promise<HealthIndicatorResult>;
  critical: boolean;
}

export class HealthCollector {
  private indicators: InternalIndicator[] = [];
  private config: ResolvedActuatorOptions['health'];

  constructor(config: ResolvedActuatorOptions['health']) {
    this.config = config;
    this.buildIndicators();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Shallow health — overall status only, no component details. */
  async shallow(): Promise<HealthResponse> {
    const components = await this.runAllIndicators();
    return { status: this.aggregateStatus(components) };
  }

  /** Deep health — overall status + per-component status and details. */
  async deep(): Promise<HealthResponse> {
    const components = await this.runAllIndicators();
    return {
      status: this.aggregateStatus(components),
      components,
    };
  }

  /** Resolve a health check call based on the configured showDetails setting. */
  async collect(showDetails?: string): Promise<HealthResponse> {
    const mode = showDetails ?? this.config.showDetails;
    return mode === 'always' ? this.deep() : this.shallow();
  }

  /** Get health for a specific component by name. */
  async component(name: string): Promise<HealthComponentResponse | null> {
    const indicator = this.indicators.find((i) => i.name === name);
    if (!indicator) return null;
    return this.runIndicator(indicator);
  }

  /** Get health for a named group (e.g. liveness, readiness). */
  async group(groupName: string): Promise<HealthResponse | null> {
    const memberNames = this.config.groups[groupName];
    if (!memberNames) return null;

    const components: Record<string, HealthComponentResponse> = {};
    for (const name of memberNames) {
      const indicator = this.indicators.find((i) => i.name === name);
      if (indicator) {
        components[name] = await this.runIndicator(indicator);
      }
    }
    return {
      status: this.aggregateStatus(components),
      components,
    };
  }

  /** List all registered indicator names. */
  indicatorNames(): string[] {
    return this.indicators.map((i) => i.name);
  }

  /** Dynamically add a custom health indicator at runtime. */
  addIndicator(reg: HealthIndicatorRegistration): void {
    this.indicators.push({
      name: reg.name,
      check: reg.check,
      critical: reg.critical ?? false,
    });
  }

  /** Remove a health indicator by name. */
  removeIndicator(name: string): boolean {
    const before = this.indicators.length;
    this.indicators = this.indicators.filter((i) => i.name !== name);
    return this.indicators.length < before;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private buildIndicators(): void {
    const { indicators, custom } = this.config;

    if (indicators.diskSpace.enabled) {
      this.indicators.push({
        name: 'diskSpace',
        check: () => this.checkDiskSpace(),
        critical: true,
      });
    }

    if (indicators.process.enabled) {
      this.indicators.push({
        name: 'process',
        check: () => this.checkProcess(),
        critical: false,
      });
    }

    for (const c of custom) {
      this.indicators.push({
        name: c.name,
        check: c.check,
        critical: c.critical ?? false,
      });
    }
  }

  private async runAllIndicators(): Promise<Record<string, HealthComponentResponse>> {
    const results: Record<string, HealthComponentResponse> = {};
    const timeout = this.config.timeout;

    await Promise.all(
      this.indicators.map(async (ind) => {
        results[ind.name] = await this.runIndicatorWithTimeout(ind, timeout);
      }),
    );

    return results;
  }

  private async runIndicator(ind: InternalIndicator): Promise<HealthComponentResponse> {
    return this.runIndicatorWithTimeout(ind, this.config.timeout);
  }

  private async runIndicatorWithTimeout(
    ind: InternalIndicator,
    timeoutMs: number,
  ): Promise<HealthComponentResponse> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race<HealthIndicatorResult>([
        ind.check(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Health check '${ind.name}' timed out after ${timeoutMs}ms`)),
            timeoutMs,
          );
          if (typeof timer.unref === 'function') timer.unref();
        }),
      ]);
      return result.details
        ? { status: result.status, details: result.details }
        : { status: result.status };
    } catch (err: any) {
      logger.warn(`Health indicator '${ind.name}' failed`, { error: err.message });
      return { status: 'DOWN', details: { error: err.message } };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private aggregateStatus(
    components: Record<string, HealthComponentResponse>,
  ): HealthStatus {
    const entries = Object.entries(components);
    if (entries.length === 0) return 'UNKNOWN';

    // If any critical indicator is DOWN → overall DOWN
    for (const [name, comp] of entries) {
      const ind = this.indicators.find((i) => i.name === name);
      if (ind?.critical && comp.status === 'DOWN') return 'DOWN';
    }

    // Priority order: DOWN > OUT_OF_SERVICE > UNKNOWN > UP
    const priority: Record<HealthStatus, number> = {
      DOWN: 0,
      OUT_OF_SERVICE: 1,
      UNKNOWN: 2,
      UP: 3,
    };

    let worst: HealthStatus = 'UP';
    for (const [, comp] of entries) {
      if (priority[comp.status] < priority[worst]) {
        worst = comp.status;
      }
    }
    return worst;
  }

  // ---------------------------------------------------------------------------
  // Built-in Indicators
  // ---------------------------------------------------------------------------

  private async checkDiskSpace(): Promise<HealthIndicatorResult> {
    const { threshold, path: diskPath } = this.config.indicators.diskSpace;

    try {
      const { free, total } = this.getDiskSpace(diskPath);
      const healthy = free >= threshold;
      return {
        status: healthy ? 'UP' : 'DOWN',
        details: { total, free, threshold, path: diskPath, exists: true },
      };
    } catch (err: any) {
      return {
        status: 'UNKNOWN',
        details: { error: err.message, path: diskPath },
      };
    }
  }

  private getDiskSpace(diskPath: string): { free: number; total: number } {
    // fs.statfsSync is cross-platform and avoids shelling out (Node >= 18.15,
    // which matches our supported engine range). No command execution means no
    // command-injection surface from a user-supplied path.
    const statfs = (fs as unknown as {
      statfsSync?: (p: string) => { blocks: number; bsize: number; bavail: number };
    }).statfsSync;

    if (typeof statfs !== 'function') {
      throw new Error('fs.statfsSync is unavailable; Node >= 18.15 is required for disk-space checks');
    }

    const stats = statfs(diskPath);
    return {
      total: stats.blocks * stats.bsize,
      free: stats.bavail * stats.bsize,
    };
  }

  private async checkProcess(): Promise<HealthIndicatorResult> {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    return {
      status: 'UP',
      details: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
        memory: {
          rss: mem.rss,
          heapTotal: mem.heapTotal,
          heapUsed: mem.heapUsed,
          external: mem.external,
        },
        cpu: {
          user: cpu.user,
          system: cpu.system,
        },
      },
    };
  }
}

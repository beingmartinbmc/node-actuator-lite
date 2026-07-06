import v8 from 'v8';
import { performance } from 'perf_hooks';
import type { ThreadDumpResponse } from '../core/types';

export class ThreadDumpCollector {
  private previousELU: ReturnType<typeof performance.eventLoopUtilization> | null = null;

  collect(): ThreadDumpResponse {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();
    const resourceUsage = typeof process.resourceUsage === 'function' ? process.resourceUsage() : null;

    return {
      timestamp: new Date().toISOString(),
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),

      mainThread: {
        name: 'main',
        state: 'RUNNABLE',
        cpuUsage,
        stackTrace: this.captureStack(),
      },

      eventLoop: {
        activeHandles: this.getActiveHandles(),
        activeRequests: this.getActiveRequests(),
        utilization: this.getEventLoopUtilization(),
      },

      workers: this.getWorkerThreads(),

      memory: memoryUsage,
      resourceUsage,
      v8HeapStats: v8.getHeapStatistics(),
      v8HeapSpaces: v8.getHeapSpaceStatistics(),
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private captureStack(): string[] {
    const orig = Error.stackTraceLimit;
    Error.stackTraceLimit = 50;
    const stack = new Error().stack?.split('\n').slice(2) ?? [];
    Error.stackTraceLimit = orig;
    return stack.map((l) => l.trim());
  }

  private getActiveHandles(): { count: number; types: string[] } {
    try {
      const handles: any[] = (process as any)._getActiveHandles?.() ?? [];
      return {
        count: handles.length,
        types: handles.map((h) => h?.constructor?.name ?? 'Unknown'),
      };
    } catch {
      return { count: 0, types: [] };
    }
  }

  private getActiveRequests(): { count: number; types: string[] } {
    try {
      const reqs: any[] = (process as any)._getActiveRequests?.() ?? [];
      return {
        count: reqs.length,
        types: reqs.map((r) => r?.constructor?.name ?? 'Unknown'),
      };
    } catch {
      return { count: 0, types: [] };
    }
  }

  /**
   * Event Loop Utilization via performance.eventLoopUtilization().
   * Provides cumulative ELU and delta since the last call (useful for
   * detecting event loop saturation — far more accurate than CPU usage
   * for Node.js applications).
   *
   * idle + active = 1.0 (proportional)
   * utilization ∈ [0, 1] — fraction of time the loop was NOT idle.
   */
  private getEventLoopUtilization(): {
    idle: number;
    active: number;
    utilization: number;
    delta: { idle: number; active: number; utilization: number } | null;
  } {
    try {
      const currentELU = performance.eventLoopUtilization();
      let delta: { idle: number; active: number; utilization: number } | null = null;

      if (this.previousELU) {
        const d = performance.eventLoopUtilization(currentELU, this.previousELU);
        delta = { idle: d.idle, active: d.active, utilization: d.utilization };
      }

      this.previousELU = currentELU;

      return {
        idle: currentELU.idle,
        active: currentELU.active,
        utilization: currentELU.utilization,
        delta,
      };
    } catch {
      return { idle: 0, active: 0, utilization: 0, delta: null };
    }
  }

  private getWorkerThreads(): Array<{ threadId: number; name: string; state: string }> {
    /* istanbul ignore next: try/catch and the worker-thread branch are only reachable when worker_threads is missing or this collector itself runs inside a worker thread */
    try {
      const wt = require('worker_threads');
      if (wt.isMainThread) return [];
      return [{ threadId: wt.threadId, name: `worker-${wt.threadId}`, state: 'RUNNABLE' }];
    } catch {
      return [];
    }
  }
}

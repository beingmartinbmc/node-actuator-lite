import v8 from 'v8';
import type { ThreadDumpResponse } from '../core/types';

export class ThreadDumpCollector {
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

  private getWorkerThreads(): Array<{ threadId: number; name: string; state: string }> {
    try {
      const wt = require('worker_threads');
      if (wt.isMainThread) return [];
      return [{ threadId: wt.threadId, name: `worker-${wt.threadId}`, state: 'RUNNABLE' }];
    } catch {
      return [];
    }
  }
}

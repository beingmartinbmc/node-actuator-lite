import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import logger from './logger';

export interface ThreadInfo {
  threadId: number;
  threadName: string;
  threadState: 'RUNNABLE' | 'BLOCKED' | 'WAITING' | 'TIMED_WAITING' | 'TERMINATED';
  blockedTime: number;
  blockedCount: number;
  waitedTime: number;
  waitedCount: number;
  lockName: string | null;
  lockOwnerId: number | null;
  lockOwnerName: string | null;
  inNative: boolean;
  suspended: boolean;
  stackTrace: string[];
  lockedMonitors: any[];
  lockedSynchronizers: any[];
  cpuTime?: number;
  userTime?: number;
  systemTime?: number;
  priority?: number;
  daemon?: boolean;
  interrupted?: boolean;
  nativeId?: number;
}

export interface EventLoopInfo {
  phase: string;
  phaseTime: number;
  activeRequests: number;
  activeHandles: number;
  pendingRequests: number;
  pendingHandles: number;
}

export interface AsyncOperationInfo {
  type: string;
  triggerId: number;
  executionId: number;
  resource: any;
  stack: string[];
  startTime: number;
  duration: number;
}

export interface ThreadDumpData {
  timestamp: string;
  threads: ThreadInfo[];
  eventLoop: EventLoopInfo;
  asyncOperations: AsyncOperationInfo[];
  workerThreads: ThreadInfo[];
  summary: {
    totalThreads: number;
    activeThreads: number;
    blockedThreads: number;
    waitingThreads: number;
    eventLoopPhase: string;
    activeRequests: number;
    pendingRequests: number;
  };
}

export class ThreadDumpCollector {
  private asyncOperations: Map<number, AsyncOperationInfo> = new Map();
  private asyncHook: any;

  constructor() {
    this.initializeAsyncHooks();
  }

  private initializeAsyncHooks(): void {
    try {
      const { AsyncHook } = require('async_hooks');
      
      this.asyncHook = AsyncHook.createHook({
        init: (asyncId: number, type: string, triggerId: number, resource: any) => {
          try {
            const stack = new Error().stack?.split('\n').slice(3) || [];
            this.asyncOperations.set(asyncId, {
              type,
              triggerId,
              executionId: asyncId,
              resource,
              stack,
              startTime: performance.now(),
              duration: 0
            });
          } catch (error) {
            // Ignore errors in async hook callbacks
          }
        },
        before: (asyncId: number) => {
          try {
            const operation = this.asyncOperations.get(asyncId);
            if (operation) {
              operation.startTime = performance.now();
            }
          } catch (error) {
            // Ignore errors in async hook callbacks
          }
        },
        after: (asyncId: number) => {
          try {
            const operation = this.asyncOperations.get(asyncId);
            if (operation) {
              operation.duration = performance.now() - operation.startTime;
            }
          } catch (error) {
            // Ignore errors in async hook callbacks
          }
        },
        destroy: (asyncId: number) => {
          try {
            this.asyncOperations.delete(asyncId);
          } catch (error) {
            // Ignore errors in async hook callbacks
          }
        }
      });

      this.asyncHook.enable();
      logger.debug('Async hooks initialized for thread dump collection');
    } catch (error) {
      logger.warn('Failed to initialize async hooks for thread dump', error);
      // Don't throw, just continue without async hooks
    }
  }

  public async collectThreadDump(): Promise<ThreadDumpData> {
    const startTime = performance.now();
    
    try {
      // Collect main thread information
      const mainThread = this.collectMainThreadInfo();
      
      // Collect worker threads information
      const workerThreads = await this.collectWorkerThreadsInfo();
      
      // Collect event loop information
      const eventLoop = this.collectEventLoopInfo();
      
      // Collect async operations
      const asyncOperations = this.collectAsyncOperationsInfo();
      
      // Generate summary
      const summary = this.generateSummary(mainThread, workerThreads, eventLoop);
      
      const collectionTime = performance.now() - startTime;
      
            logger.debug('Thread dump collected successfully', {
        collectionTime: `${collectionTime.toFixed(2)}ms`,
        totalThreads: summary.totalThreads,
        activeRequests: summary.activeRequests
      });

      return {
        timestamp: new Date().toISOString(),
        threads: [mainThread],
        eventLoop,
        asyncOperations,
        workerThreads,
        summary
      };
    } catch (error) {
      logger.error('Failed to collect thread dump', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  private collectMainThreadInfo(): ThreadInfo {
    let cpuUsage = { user: 0, system: 0 };
    
    try {
      cpuUsage = process.cpuUsage();
    } catch (error) {
      logger.warn('Failed to get CPU usage', error);
    }
    
    // Get detailed stack trace
    const stackTrace = this.getDetailedStackTrace();
    
    // Determine thread state based on event loop and async operations
    const threadState = this.determineThreadState();
    
    return {
      threadId: process.pid,
      threadName: 'main',
      threadState,
      blockedTime: 0, // Node.js doesn't track this directly
      blockedCount: 0,
      waitedTime: 0,
      waitedCount: 0,
      lockName: null,
      lockOwnerId: null,
      lockOwnerName: null,
      inNative: false,
      suspended: false,
      stackTrace,
      lockedMonitors: [],
      lockedSynchronizers: [],
      cpuTime: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      userTime: cpuUsage.user / 1000000,
      systemTime: cpuUsage.system / 1000000,
      priority: 0, // Node.js doesn't expose process priority easily
      daemon: false,
      interrupted: false,
      nativeId: process.pid
    };
  }

  private async collectWorkerThreadsInfo(): Promise<ThreadInfo[]> {
    const workerThreads: ThreadInfo[] = [];
    
    try {
      // Get all worker threads (if any are being used)
      const workers = (global as any).__worker_threads || [];
      
      for (const worker of workers) {
        if (worker instanceof Worker) {
          const threadInfo: ThreadInfo = {
            threadId: worker.threadId,
            threadName: `worker-${worker.threadId}`,
            threadState: 'RUNNABLE', // Worker threads don't expose termination state easily
            blockedTime: 0,
            blockedCount: 0,
            waitedTime: 0,
            waitedCount: 0,
            lockName: null,
            lockOwnerId: null,
            lockOwnerName: null,
            inNative: false,
            suspended: false,
            stackTrace: [], // Worker threads don't expose stack traces easily
            lockedMonitors: [],
            lockedSynchronizers: [],
            daemon: false,
            interrupted: false,
            nativeId: worker.threadId
          };
          
          workerThreads.push(threadInfo);
        }
      }
    } catch (error) {
      logger.warn('Failed to collect worker threads info', error);
    }
    
    return workerThreads;
  }

  private collectEventLoopInfo(): EventLoopInfo {
    try {
      const { performance } = require('perf_hooks');
      
      // Get event loop information
      const eventLoop = {
        phase: this.getEventLoopPhase(),
        phaseTime: performance.now(),
        activeRequests: (process as any)._getActiveRequests?.()?.length || 0,
        activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
        pendingRequests: 0, // This is not directly accessible
        pendingHandles: 0   // This is not directly accessible
      };
      
      return eventLoop;
    } catch (error) {
      logger.warn('Failed to collect event loop info', error);
      return {
        phase: 'unknown',
        phaseTime: performance.now(),
        activeRequests: 0,
        activeHandles: 0,
        pendingRequests: 0,
        pendingHandles: 0
      };
    }
  }

  private collectAsyncOperationsInfo(): AsyncOperationInfo[] {
    const operations: AsyncOperationInfo[] = [];
    
    // Get recent async operations
    this.asyncOperations.forEach((operation) => {
      if (operation.duration > 0) { // Only include completed operations
        operations.push({
          ...operation,
          duration: operation.duration
        });
      }
    });
    
    // Sort by duration (longest first) and limit to top 50
    return operations
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 50);
  }

  private getDetailedStackTrace(): string[] {
    const stack = new Error().stack?.split('\n') || [];
    return stack.slice(2); // Remove Error constructor and this method
  }

  private determineThreadState(): 'RUNNABLE' | 'BLOCKED' | 'WAITING' | 'TIMED_WAITING' | 'TERMINATED' {
    // In Node.js, the main thread is typically RUNNABLE unless it's blocked
    // We can try to detect if it's blocked by checking for long-running operations
    
    const activeRequests = (process as any)._getActiveRequests?.()?.length || 0;
    const activeHandles = (process as any)._getActiveHandles?.()?.length || 0;
    
    if (activeRequests > 0 || activeHandles > 0) {
      return 'RUNNABLE';
    }
    
    // Check if there are any pending timers or I/O operations
    const hasPendingOperations = this.asyncOperations.size > 0;
    
    return hasPendingOperations ? 'RUNNABLE' : 'WAITING';
  }

  private getEventLoopPhase(): string {
    // Node.js event loop phases: timers, pending callbacks, idle, prepare, 
    // poll, check, close callbacks
    // Unfortunately, we can't directly access the current phase from user code
    // We can make an educated guess based on what's happening
    
    const activeRequests = (process as any)._getActiveRequests?.() || [];
    const activeHandles = (process as any)._getActiveHandles?.() || [];
    
    if (activeRequests.length > 0) {
      return 'poll'; // Most likely in poll phase if there are active requests
    }
    
    if (activeHandles.length > 0) {
      return 'check'; // Likely in check phase if there are active handles
    }
    
    return 'idle'; // Default to idle if no active operations
  }

  private generateSummary(
    mainThread: ThreadInfo,
    workerThreads: ThreadInfo[],
    eventLoop: EventLoopInfo
  ) {
    const allThreads = [mainThread, ...workerThreads];
    
    const activeThreads = allThreads.filter(t => t.threadState === 'RUNNABLE').length;
    const blockedThreads = allThreads.filter(t => t.threadState === 'BLOCKED').length;
    const waitingThreads = allThreads.filter(t => t.threadState === 'WAITING' || t.threadState === 'TIMED_WAITING').length;
    
    return {
      totalThreads: allThreads.length,
      activeThreads,
      blockedThreads,
      waitingThreads,
      eventLoopPhase: eventLoop.phase,
      activeRequests: eventLoop.activeRequests,
      pendingRequests: eventLoop.pendingRequests
    };
  }

  public destroy(): void {
    if (this.asyncHook) {
      this.asyncHook.disable();
    }
    this.asyncOperations.clear();
  }
} 
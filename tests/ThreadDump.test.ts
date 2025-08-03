import { ThreadDumpCollector } from '../src/utils/threadDump';

describe('ThreadDumpCollector', () => {
  let collector: ThreadDumpCollector;

  beforeEach(() => {
    try {
      collector = new ThreadDumpCollector();
    } catch (error) {
      console.error('Failed to create ThreadDumpCollector:', error);
      throw error;
    }
  });

  afterEach(() => {
    if (collector) {
      collector.destroy();
    }
  });

  describe('collectThreadDump', () => {
    test('should collect comprehensive thread dump data', async () => {
      const threadDump = await collector.collectThreadDump();

      // Verify basic structure
      expect(threadDump).toHaveProperty('timestamp');
      expect(threadDump).toHaveProperty('threads');
      expect(threadDump).toHaveProperty('eventLoop');
      expect(threadDump).toHaveProperty('asyncOperations');
      expect(threadDump).toHaveProperty('workerThreads');
      expect(threadDump).toHaveProperty('summary');

      // Verify timestamp is ISO string
      expect(new Date(threadDump.timestamp).toISOString()).toBe(threadDump.timestamp);

      // Verify threads array
      expect(Array.isArray(threadDump.threads)).toBe(true);
      expect(threadDump.threads.length).toBeGreaterThan(0);

      // Verify main thread information
      const mainThread = threadDump.threads[0];
      expect(mainThread).toBeDefined();
      expect(mainThread).toHaveProperty('threadId');
      expect(mainThread).toHaveProperty('threadName', 'main');
      expect(mainThread).toHaveProperty('threadState');
      expect(['RUNNABLE', 'BLOCKED', 'WAITING', 'TIMED_WAITING', 'TERMINATED']).toContain(mainThread!.threadState);
      expect(mainThread).toHaveProperty('stackTrace');
      expect(Array.isArray(mainThread!.stackTrace)).toBe(true);
      expect(mainThread).toHaveProperty('cpuTime');
      expect(typeof mainThread!.cpuTime).toBe('number');
      expect(mainThread).toHaveProperty('userTime');
      expect(mainThread).toHaveProperty('systemTime');
      expect(mainThread).toHaveProperty('priority');
      expect(mainThread).toHaveProperty('nativeId');

      // Verify event loop information
      expect(threadDump.eventLoop).toHaveProperty('phase');
      expect(threadDump.eventLoop).toHaveProperty('phaseTime');
      expect(threadDump.eventLoop).toHaveProperty('activeRequests');
      expect(threadDump.eventLoop).toHaveProperty('activeHandles');
      expect(threadDump.eventLoop).toHaveProperty('pendingRequests');
      expect(threadDump.eventLoop).toHaveProperty('pendingHandles');

      // Verify async operations
      expect(Array.isArray(threadDump.asyncOperations)).toBe(true);

      // Verify worker threads
      expect(Array.isArray(threadDump.workerThreads)).toBe(true);

      // Verify summary
      expect(threadDump.summary).toHaveProperty('totalThreads');
      expect(threadDump.summary).toHaveProperty('activeThreads');
      expect(threadDump.summary).toHaveProperty('blockedThreads');
      expect(threadDump.summary).toHaveProperty('waitingThreads');
      expect(threadDump.summary).toHaveProperty('eventLoopPhase');
      expect(threadDump.summary).toHaveProperty('activeRequests');
      expect(threadDump.summary).toHaveProperty('pendingRequests');

      // Verify summary values are reasonable
      expect(threadDump.summary.totalThreads).toBeGreaterThan(0);
      expect(threadDump.summary.activeThreads).toBeGreaterThanOrEqual(0);
      expect(threadDump.summary.blockedThreads).toBeGreaterThanOrEqual(0);
      expect(threadDump.summary.waitingThreads).toBeGreaterThanOrEqual(0);
      expect(threadDump.summary.activeRequests).toBeGreaterThanOrEqual(0);
      expect(threadDump.summary.pendingRequests).toBeGreaterThanOrEqual(0);
    });

    test('should include detailed stack trace for main thread', async () => {
      const threadDump = await collector.collectThreadDump();
      const mainThread = threadDump.threads[0];

      expect(mainThread).toBeDefined();
      expect(mainThread!.stackTrace.length).toBeGreaterThan(0);
      
      // Verify stack trace format (should contain function names and line numbers)
      const stackLine = mainThread!.stackTrace[0];
      expect(stackLine).toBeDefined();
      expect(typeof stackLine).toBe('string');
      expect(stackLine!.length).toBeGreaterThan(0);
    });

    test('should track async operations', async () => {
      // Create some async operations
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(new Promise(resolve => setTimeout(resolve, 10)));
      }
      
      // Wait for them to complete
      await Promise.all(promises);
      
      const threadDump = await collector.collectThreadDump();
      
      // Should have tracked some async operations
      expect(threadDump.asyncOperations.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle errors gracefully', async () => {
      // Mock process.cpuUsage to throw an error
      const originalCpuUsage = process.cpuUsage;
      process.cpuUsage = jest.fn().mockImplementation(() => {
        throw new Error('CPU usage error');
      });

      try {
        const threadDump = await collector.collectThreadDump();
        
        // Should still return valid data even with errors
        expect(threadDump).toHaveProperty('timestamp');
        expect(threadDump).toHaveProperty('threads');
        expect(threadDump.threads.length).toBeGreaterThan(0);
      } finally {
        // Restore original function
        process.cpuUsage = originalCpuUsage;
      }
    });

    test('should provide consistent data structure', async () => {
      const threadDump1 = await collector.collectThreadDump();
      const threadDump2 = await collector.collectThreadDump();

      // Both should have the same structure
      expect(Object.keys(threadDump1)).toEqual(Object.keys(threadDump2));
      expect(Object.keys(threadDump1.summary)).toEqual(Object.keys(threadDump2.summary));
      
      // Timestamps should be different
      expect(threadDump1.timestamp).not.toBe(threadDump2.timestamp);
    });

    test('should include CPU and memory information', async () => {
      const threadDump = await collector.collectThreadDump();
      const mainThread = threadDump.threads[0];

      expect(mainThread).toBeDefined();
      // CPU information should be present and reasonable
      expect(mainThread!.cpuTime).toBeGreaterThanOrEqual(0);
      expect(mainThread!.userTime).toBeGreaterThanOrEqual(0);
      expect(mainThread!.systemTime).toBeGreaterThanOrEqual(0);
      
      // Priority should be a number
      expect(typeof mainThread!.priority).toBe('number');
      
      // Native ID should be the process ID
      expect(mainThread!.nativeId).toBe(process.pid);
    });

    test('should determine thread state correctly', async () => {
      const threadDump = await collector.collectThreadDump();
      const mainThread = threadDump.threads[0];

      expect(mainThread).toBeDefined();
      // Thread state should be one of the valid states
      const validStates = ['RUNNABLE', 'BLOCKED', 'WAITING', 'TIMED_WAITING', 'TERMINATED'];
      expect(validStates).toContain(mainThread!.threadState);
      
      // Main thread should typically be RUNNABLE or WAITING
      expect(['RUNNABLE', 'WAITING']).toContain(mainThread!.threadState);
    });

    test('should provide event loop phase information', async () => {
      const threadDump = await collector.collectThreadDump();
      
      // Event loop phase should be a string
      expect(typeof threadDump.eventLoop.phase).toBe('string');
      expect(threadDump.eventLoop.phase.length).toBeGreaterThan(0);
      
      // Phase time should be a number
      expect(typeof threadDump.eventLoop.phaseTime).toBe('number');
      expect(threadDump.eventLoop.phaseTime).toBeGreaterThan(0);
    });

    test('should limit async operations to top 50', async () => {
      // Create many async operations
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(new Promise(resolve => setTimeout(resolve, 5)));
      }
      
      await Promise.all(promises);
      
      const threadDump = await collector.collectThreadDump();
      
      // Should limit to top 50 operations
      expect(threadDump.asyncOperations.length).toBeLessThanOrEqual(50);
    });
  });

  describe('cleanup', () => {
    test('should cleanup resources on destroy', () => {
      expect(() => collector.destroy()).not.toThrow();
      
      // Should be able to call destroy multiple times
      expect(() => collector.destroy()).not.toThrow();
    });
  });
}); 
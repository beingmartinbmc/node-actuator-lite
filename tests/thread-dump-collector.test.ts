import { ThreadDumpCollector } from '../src/collectors/ThreadDumpCollector';

describe('ThreadDumpCollector', () => {
  const collector = new ThreadDumpCollector();

  test('collect() returns all top-level fields', () => {
    const td = collector.collect();

    expect(td.timestamp).toBeDefined();
    expect(typeof td.timestamp).toBe('string');
    expect(td.pid).toBe(process.pid);
    expect(td.nodeVersion).toBe(process.version);
    expect(td.platform).toBe(process.platform);
    expect(td.arch).toBe(process.arch);
    expect(typeof td.uptime).toBe('number');
    expect(td.uptime).toBeGreaterThan(0);
  });

  test('mainThread has correct structure', () => {
    const td = collector.collect();
    expect(td.mainThread.name).toBe('main');
    expect(td.mainThread.state).toBe('RUNNABLE');
    expect(td.mainThread.cpuUsage).toBeDefined();
    expect(typeof td.mainThread.cpuUsage.user).toBe('number');
    expect(typeof td.mainThread.cpuUsage.system).toBe('number');
  });

  test('mainThread.stackTrace is a non-empty string array', () => {
    const td = collector.collect();
    expect(Array.isArray(td.mainThread.stackTrace)).toBe(true);
    expect(td.mainThread.stackTrace.length).toBeGreaterThan(0);
    expect(typeof td.mainThread.stackTrace[0]).toBe('string');
  });

  test('eventLoop.activeHandles has count and types', () => {
    const td = collector.collect();
    expect(typeof td.eventLoop.activeHandles.count).toBe('number');
    expect(Array.isArray(td.eventLoop.activeHandles.types)).toBe(true);
  });

  test('eventLoop.activeRequests has count and types', () => {
    const td = collector.collect();
    expect(typeof td.eventLoop.activeRequests.count).toBe('number');
    expect(Array.isArray(td.eventLoop.activeRequests.types)).toBe(true);
  });

  test('workers is an array (empty on main thread)', () => {
    const td = collector.collect();
    expect(Array.isArray(td.workers)).toBe(true);
    // We're running on main thread, so should be empty
    expect(td.workers.length).toBe(0);
  });

  test('memory has expected fields', () => {
    const td = collector.collect();
    expect(typeof td.memory.rss).toBe('number');
    expect(typeof td.memory.heapTotal).toBe('number');
    expect(typeof td.memory.heapUsed).toBe('number');
    expect(typeof td.memory.external).toBe('number');
  });

  test('resourceUsage is present on Node 18+', () => {
    const td = collector.collect();
    // On Node 18+, resourceUsage should be an object
    expect(td.resourceUsage).not.toBeNull();
    expect(typeof td.resourceUsage).toBe('object');
  });

  test('v8HeapStats has expected fields', () => {
    const td = collector.collect();
    expect(td.v8HeapStats).toBeDefined();
    expect(typeof td.v8HeapStats['total_heap_size']).toBe('number');
    expect(typeof td.v8HeapStats['used_heap_size']).toBe('number');
  });

  test('v8HeapSpaces is a non-empty array', () => {
    const td = collector.collect();
    expect(Array.isArray(td.v8HeapSpaces)).toBe(true);
    expect(td.v8HeapSpaces.length).toBeGreaterThan(0);
  });

  test('multiple calls return fresh data', () => {
    const td1 = collector.collect();
    const td2 = collector.collect();
    // Timestamps should differ (or be very close)
    expect(td2.uptime).toBeGreaterThanOrEqual(td1.uptime);
  });

  test('activeHandles falls back to empty when _getActiveHandles throws', () => {
    const orig = (process as any)._getActiveHandles;
    (process as any)._getActiveHandles = () => {
      throw new Error('handles boom');
    };
    try {
      const td = collector.collect();
      expect(td.eventLoop.activeHandles.count).toBe(0);
      expect(td.eventLoop.activeHandles.types).toEqual([]);
    } finally {
      (process as any)._getActiveHandles = orig;
    }
  });

  test('activeRequests falls back to empty when _getActiveRequests throws', () => {
    const orig = (process as any)._getActiveRequests;
    (process as any)._getActiveRequests = () => {
      throw new Error('requests boom');
    };
    try {
      const td = collector.collect();
      expect(td.eventLoop.activeRequests.count).toBe(0);
      expect(td.eventLoop.activeRequests.types).toEqual([]);
    } finally {
      (process as any)._getActiveRequests = orig;
    }
  });

  test('handle/request types fall back to "Unknown" when constructor is missing', () => {
    const origH = (process as any)._getActiveHandles;
    const origR = (process as any)._getActiveRequests;
    (process as any)._getActiveHandles = () => [Object.create(null), null];
    (process as any)._getActiveRequests = () => [Object.create(null), null];
    try {
      const td = collector.collect();
      expect(td.eventLoop.activeHandles.types).toEqual(['Unknown', 'Unknown']);
      expect(td.eventLoop.activeRequests.types).toEqual(['Unknown', 'Unknown']);
    } finally {
      (process as any)._getActiveHandles = origH;
      (process as any)._getActiveRequests = origR;
    }
  });

  test('resourceUsage is null when process.resourceUsage is unavailable', () => {
    const orig = process.resourceUsage;
    (process as any).resourceUsage = undefined;
    try {
      const td = collector.collect();
      expect(td.resourceUsage).toBeNull();
    } finally {
      (process as any).resourceUsage = orig;
    }
  });
});

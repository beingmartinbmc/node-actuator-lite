import { MetricsCollector } from '../src/metrics/MetricsCollector';

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    metricsCollector = new MetricsCollector();
  });

  describe('Initialization', () => {
    test('should initialize metrics collector', () => {
      expect(metricsCollector).toBeDefined();
    });
  });

  describe('Metrics Collection', () => {
    test('should collect system metrics', async () => {
      const metrics = await metricsCollector.collect();
      
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('system');
      expect(metrics).toHaveProperty('process');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('uptime');
    });

    test('should include system information', async () => {
      const metrics = await metricsCollector.collect();
      
      expect(metrics.system).toHaveProperty('hostname');
      expect(metrics.system).toHaveProperty('platform');
      expect(metrics.system).toHaveProperty('arch');
      expect(metrics.system).toHaveProperty('nodeVersion');
      expect(metrics.system).toHaveProperty('totalMemory');
      expect(metrics.system).toHaveProperty('freeMemory');
      expect(metrics.system).toHaveProperty('loadAverage');
      
      expect(typeof metrics.system.hostname).toBe('string');
      expect(typeof metrics.system.platform).toBe('string');
      expect(typeof metrics.system.arch).toBe('string');
      expect(typeof metrics.system.nodeVersion).toBe('string');
      expect(typeof metrics.system.totalMemory).toBe('number');
      expect(typeof metrics.system.freeMemory).toBe('number');
      expect(Array.isArray(metrics.system.loadAverage)).toBe(true);
    });

    test('should include process information', async () => {
      const metrics = await metricsCollector.collect();
      
      expect(metrics.process).toHaveProperty('pid');
      expect(metrics.process).toHaveProperty('uptime');
      expect(metrics.process).toHaveProperty('version');
      expect(metrics.process).toHaveProperty('memoryUsage');
      expect(metrics.process).toHaveProperty('cpuUsage');
      
      expect(typeof metrics.process.pid).toBe('number');
      expect(typeof metrics.process.uptime).toBe('number');
      expect(typeof metrics.process.version).toBe('string');
      expect(typeof metrics.process.memoryUsage.rss).toBe('number');
      expect(typeof metrics.process.memoryUsage.heapTotal).toBe('number');
      expect(typeof metrics.process.memoryUsage.heapUsed).toBe('number');
      expect(typeof metrics.process.memoryUsage.external).toBe('number');
      expect(typeof metrics.process.cpuUsage.user).toBe('number');
      expect(typeof metrics.process.cpuUsage.system).toBe('number');
    });

    test('should include memory metrics', async () => {
      const metrics = await metricsCollector.collect();
      
      expect(metrics.memory).toHaveProperty('total');
      expect(metrics.memory).toHaveProperty('used');
      expect(metrics.memory).toHaveProperty('free');
      expect(metrics.memory).toHaveProperty('usagePercentage');
      expect(metrics.memory).toHaveProperty('processRss');
      expect(metrics.memory).toHaveProperty('processHeapTotal');
      expect(metrics.memory).toHaveProperty('processHeapUsed');
      expect(metrics.memory).toHaveProperty('processExternal');
      
      expect(typeof metrics.memory.total).toBe('number');
      expect(typeof metrics.memory.used).toBe('number');
      expect(typeof metrics.memory.free).toBe('number');
      expect(typeof metrics.memory.usagePercentage).toBe('number');
      expect(typeof metrics.memory.processRss).toBe('number');
      expect(typeof metrics.memory.processHeapTotal).toBe('number');
      expect(typeof metrics.memory.processHeapUsed).toBe('number');
      expect(typeof metrics.memory.processExternal).toBe('number');
    });

    test('should include CPU metrics', async () => {
      const metrics = await metricsCollector.collect();
      
      expect(metrics.cpu).toHaveProperty('loadAverage');
      expect(metrics.cpu).toHaveProperty('cpuCount');
      expect(metrics.cpu).toHaveProperty('loadPercentage');
      expect(metrics.cpu).toHaveProperty('processCpuUser');
      expect(metrics.cpu).toHaveProperty('processCpuSystem');
      
      expect(Array.isArray(metrics.cpu.loadAverage)).toBe(true);
      expect(typeof metrics.cpu.cpuCount).toBe('number');
      expect(typeof metrics.cpu.loadPercentage).toBe('number');
      expect(typeof metrics.cpu.processCpuUser).toBe('number');
      expect(typeof metrics.cpu.processCpuSystem).toBe('number');
    });
  });

  describe('Formatted Metrics', () => {
    test('should return formatted metrics', async () => {
      const formattedMetrics = await metricsCollector.getFormattedMetrics();
      
      expect(formattedMetrics).toHaveProperty('timestamp');
      expect(formattedMetrics).toHaveProperty('uptime');
      expect(formattedMetrics).toHaveProperty('system');
      expect(formattedMetrics).toHaveProperty('process');
      expect(formattedMetrics).toHaveProperty('memory');
      expect(formattedMetrics).toHaveProperty('cpu');
    });

    test('should format system metrics correctly', async () => {
      const formattedMetrics = await metricsCollector.getFormattedMetrics();
      
      expect(formattedMetrics['system']).toHaveProperty('hostname');
      expect(formattedMetrics['system']).toHaveProperty('platform');
      expect(formattedMetrics['system']).toHaveProperty('arch');
      expect(formattedMetrics['system']).toHaveProperty('nodeVersion');
      expect(formattedMetrics['system']).toHaveProperty('totalMemory');
      expect(formattedMetrics['system']).toHaveProperty('freeMemory');
      expect(formattedMetrics['system']).toHaveProperty('loadAverage');
      
      // Check that memory values are formatted as strings with GB
      expect(typeof formattedMetrics['system'].totalMemory).toBe('string');
      expect(typeof formattedMetrics['system'].freeMemory).toBe('string');
      expect(formattedMetrics['system'].totalMemory).toMatch(/^\d+\.\d+ GB$/);
      expect(formattedMetrics['system'].freeMemory).toMatch(/^\d+\.\d+ GB$/);
      
      // Check that load average is formatted as array of strings
      expect(Array.isArray(formattedMetrics['system'].loadAverage)).toBe(true);
      formattedMetrics['system'].loadAverage.forEach((load: string) => {
        expect(typeof load).toBe('string');
        expect(load).toMatch(/^\d+\.\d+$/);
      });
    });

    test('should format process metrics correctly', async () => {
      const formattedMetrics = await metricsCollector.getFormattedMetrics();
      
      expect(formattedMetrics['process']).toHaveProperty('pid');
      expect(formattedMetrics['process']).toHaveProperty('uptime');
      expect(formattedMetrics['process']).toHaveProperty('version');
      expect(formattedMetrics['process']).toHaveProperty('memoryUsage');
      expect(formattedMetrics['process']).toHaveProperty('cpuUsage');
      
      // Check that uptime is formatted as string with 's'
      expect(typeof formattedMetrics['process'].uptime).toBe('string');
      expect(formattedMetrics['process'].uptime).toMatch(/^\d+\.\d+s$/);
      
      // Check that memory usage values are formatted as strings with MB
      expect(typeof formattedMetrics['process'].memoryUsage.rss).toBe('string');
      expect(typeof formattedMetrics['process'].memoryUsage.heapTotal).toBe('string');
      expect(typeof formattedMetrics['process'].memoryUsage.heapUsed).toBe('string');
      expect(typeof formattedMetrics['process'].memoryUsage.external).toBe('string');
      
      expect(formattedMetrics['process'].memoryUsage.rss).toMatch(/^\d+\.\d+ MB$/);
      expect(formattedMetrics['process'].memoryUsage.heapTotal).toMatch(/^\d+\.\d+ MB$/);
      expect(formattedMetrics['process'].memoryUsage.heapUsed).toMatch(/^\d+\.\d+ MB$/);
      expect(formattedMetrics['process'].memoryUsage.external).toMatch(/^\d+\.\d+ MB$/);
      
      // Check that CPU usage values are formatted as strings with 's'
      expect(typeof formattedMetrics['process'].cpuUsage.user).toBe('string');
      expect(typeof formattedMetrics['process'].cpuUsage.system).toBe('string');
      expect(formattedMetrics['process'].cpuUsage.user).toMatch(/^\d+\.\d+s$/);
      expect(formattedMetrics['process'].cpuUsage.system).toMatch(/^\d+\.\d+s$/);
    });

    test('should format memory metrics correctly', async () => {
      const formattedMetrics = await metricsCollector.getFormattedMetrics();
      
      expect(formattedMetrics['memory']).toHaveProperty('total');
      expect(formattedMetrics['memory']).toHaveProperty('used');
      expect(formattedMetrics['memory']).toHaveProperty('free');
      expect(formattedMetrics['memory']).toHaveProperty('usagePercentage');
      expect(formattedMetrics['memory']).toHaveProperty('processRss');
      expect(formattedMetrics['memory']).toHaveProperty('processHeapTotal');
      expect(formattedMetrics['memory']).toHaveProperty('processHeapUsed');
      expect(formattedMetrics['memory']).toHaveProperty('processExternal');
      
      // Check that memory values are formatted as strings with GB
      expect(typeof formattedMetrics['memory'].total).toBe('string');
      expect(typeof formattedMetrics['memory'].used).toBe('string');
      expect(typeof formattedMetrics['memory'].free).toBe('string');
      expect(typeof formattedMetrics['memory'].usagePercentage).toBe('string');
      
      expect(formattedMetrics['memory'].total).toMatch(/^\d+\.\d+ GB$/);
      expect(formattedMetrics['memory'].used).toMatch(/^\d+\.\d+ GB$/);
      expect(formattedMetrics['memory'].free).toMatch(/^\d+\.\d+ GB$/);
      expect(formattedMetrics['memory'].usagePercentage).toMatch(/^\d+\.\d+%$/);
      
      // Check that process memory values are formatted as strings with MB
      expect(typeof formattedMetrics['memory'].processRss).toBe('string');
      expect(typeof formattedMetrics['memory'].processHeapTotal).toBe('string');
      expect(typeof formattedMetrics['memory'].processHeapUsed).toBe('string');
      expect(typeof formattedMetrics['memory'].processExternal).toBe('string');
      
      expect(formattedMetrics['memory'].processRss).toMatch(/^\d+\.\d+ MB$/);
      expect(formattedMetrics['memory'].processHeapTotal).toMatch(/^\d+\.\d+ MB$/);
      expect(formattedMetrics['memory'].processHeapUsed).toMatch(/^\d+\.\d+ MB$/);
      expect(formattedMetrics['memory'].processExternal).toMatch(/^\d+\.\d+ MB$/);
    });

    test('should format CPU metrics correctly', async () => {
      const formattedMetrics = await metricsCollector.getFormattedMetrics();
      
      expect(formattedMetrics['cpu']).toHaveProperty('loadAverage');
      expect(formattedMetrics['cpu']).toHaveProperty('cpuCount');
      expect(formattedMetrics['cpu']).toHaveProperty('loadPercentage');
      expect(formattedMetrics['cpu']).toHaveProperty('processCpuUser');
      expect(formattedMetrics['cpu']).toHaveProperty('processCpuSystem');
      
      // Check that load average is formatted as array of strings
      expect(Array.isArray(formattedMetrics['cpu'].loadAverage)).toBe(true);
      formattedMetrics['cpu'].loadAverage.forEach((load: string) => {
        expect(typeof load).toBe('string');
        expect(load).toMatch(/^\d+\.\d+$/);
      });
      
      // Check that CPU count is a number
      expect(typeof formattedMetrics['cpu'].cpuCount).toBe('number');
      
      // Check that load percentage is formatted as string with '%'
      expect(typeof formattedMetrics['cpu'].loadPercentage).toBe('string');
      expect(formattedMetrics['cpu'].loadPercentage).toMatch(/^\d+\.\d+%$/);
      
      // Check that CPU usage values are formatted as strings with 's'
      expect(typeof formattedMetrics['cpu'].processCpuUser).toBe('string');
      expect(typeof formattedMetrics['cpu'].processCpuSystem).toBe('string');
      expect(formattedMetrics['cpu'].processCpuUser).toMatch(/^\d+\.\d+s$/);
      expect(formattedMetrics['cpu'].processCpuSystem).toMatch(/^\d+\.\d+s$/);
    });
  });

  describe('Custom Metrics', () => {
    test('should add custom counter metric', () => {
      const counter = metricsCollector.addCustomMetric(
        'test_counter',
        'Test counter metric',
        'counter',
        { labelNames: ['label1', 'label2'] }
      );

      expect(counter).toBeDefined();
      expect(metricsCollector.getCustomMetric('test_counter')).toBe(counter);
    });

    test('should add custom gauge metric', () => {
      const gauge = metricsCollector.addCustomMetric(
        'test_gauge',
        'Test gauge metric',
        'gauge',
        { labelNames: ['label1'] }
      );

      expect(gauge).toBeDefined();
      expect(metricsCollector.getCustomMetric('test_gauge')).toBe(gauge);
    });

    test('should add custom histogram metric', () => {
      const histogram = metricsCollector.addCustomMetric(
        'test_histogram',
        'Test histogram metric',
        'histogram',
        { labelNames: ['method', 'route'] }
      );

      expect(histogram).toBeDefined();
      expect(metricsCollector.getCustomMetric('test_histogram')).toBe(histogram);
    });

    test('should throw error for invalid metric type', () => {
      expect(() => {
        metricsCollector.addCustomMetric('invalid', 'Invalid metric', 'invalid' as any);
      }).toThrow('Unknown metric type: invalid');
    });

    test('should remove custom metric', () => {
      const metric = metricsCollector.addCustomMetric('to_remove', 'To remove', 'counter');
      
      expect(metricsCollector.getCustomMetric('to_remove')).toBe(metric);
      
      const removed = metricsCollector.removeCustomMetric('to_remove');
      expect(removed).toBe(true);
      
      expect(metricsCollector.getCustomMetric('to_remove')).toBeUndefined();
    });

    test('should return false when removing non-existent metric', () => {
      const removed = metricsCollector.removeCustomMetric('non_existent');
      expect(removed).toBe(false);
    });

    test('should get all custom metrics', () => {
      const counter = metricsCollector.addCustomMetric('counter1', 'Counter 1', 'counter');
      const gauge = metricsCollector.addCustomMetric('gauge1', 'Gauge 1', 'gauge');
      const histogram = metricsCollector.addCustomMetric('histogram1', 'Histogram 1', 'histogram');

      const customMetrics = metricsCollector.getCustomMetrics();
      
      expect(customMetrics.size).toBe(3);
      expect(customMetrics.get('counter1')).toBe(counter);
      expect(customMetrics.get('gauge1')).toBe(gauge);
      expect(customMetrics.get('histogram1')).toBe(histogram);
    });

    test('should return undefined for non-existent metric', () => {
      const metric = metricsCollector.getCustomMetric('non_existent');
      expect(metric).toBeUndefined();
    });
  });

  describe('Data Validation', () => {
    test('should have valid timestamp format', async () => {
      const metrics = await metricsCollector.collect();
      
      expect(metrics.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should have positive uptime', async () => {
      const metrics = await metricsCollector.collect();
      
      expect(metrics.uptime).toBeGreaterThan(0);
    });

    test('should have valid memory values', async () => {
      const metrics = await metricsCollector.collect();
      
      expect(metrics.memory.total).toBeGreaterThan(0);
      expect(metrics.memory.used).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.free).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.usagePercentage).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.usagePercentage).toBeLessThanOrEqual(100);
    });

    test('should have valid CPU values', async () => {
      const metrics = await metricsCollector.collect();
      
      expect(metrics.cpu.cpuCount).toBeGreaterThan(0);
      expect(metrics.cpu.loadPercentage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.processCpuUser).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.processCpuSystem).toBeGreaterThanOrEqual(0);
    });

    test('should have valid load average array', async () => {
      const metrics = await metricsCollector.collect();
      
      expect(Array.isArray(metrics.cpu.loadAverage)).toBe(true);
      expect(metrics.cpu.loadAverage.length).toBe(3);
      
      metrics.cpu.loadAverage.forEach((load: number) => {
        expect(typeof load).toBe('number');
        expect(load).toBeGreaterThanOrEqual(0);
      });
    });
  });
}); 
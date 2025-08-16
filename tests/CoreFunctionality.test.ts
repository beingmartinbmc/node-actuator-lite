import { MetricsCollector } from '../src/metrics/MetricsCollector';
import { HealthChecker } from '../src/health/HealthChecker';
import { InfoCollector } from '../src/info/InfoCollector';
import { EnvironmentCollector } from '../src/env/EnvironmentCollector';

describe('Core Functionality Tests', () => {
  describe('MetricsCollector', () => {
    let metricsCollector: MetricsCollector;

    beforeEach(() => {
      metricsCollector = new MetricsCollector();
    });

    it('should collect system metrics', async () => {
      const metrics = await metricsCollector.collect();
      
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('system');
      expect(metrics).toHaveProperty('process');
      
      expect(metrics.system).toHaveProperty('hostname');
      expect(metrics.system).toHaveProperty('platform');
      expect(metrics.system).toHaveProperty('arch');
      expect(metrics.system).toHaveProperty('nodeVersion');
      expect(metrics.system).toHaveProperty('totalMemory');
      expect(metrics.system).toHaveProperty('freeMemory');
      expect(metrics.system).toHaveProperty('loadAverage');
      expect(metrics.system).toHaveProperty('cpuCount');
      expect(metrics.system).toHaveProperty('uptime');
    });

    it('should collect process metrics', async () => {
      const metrics = await metricsCollector.collect();
      
      expect(metrics.process).toHaveProperty('pid');
      expect(metrics.process).toHaveProperty('uptime');
      expect(metrics.process).toHaveProperty('version');
      expect(metrics.process).toHaveProperty('memoryUsage');
      expect(metrics.process).toHaveProperty('cpuUsage');
    });

    it('should provide individual metric methods', () => {
      const systemInfo = metricsCollector.getSystemInfo();
      const processInfo = metricsCollector.getProcessInfo();
      const memoryInfo = metricsCollector.getMemoryInfo();
      const cpuInfo = metricsCollector.getCpuInfo();

      expect(systemInfo).toBeDefined();
      expect(processInfo).toBeDefined();
      expect(memoryInfo).toBeDefined();
      expect(cpuInfo).toBeDefined();
    });
  });

  describe('HealthChecker', () => {
    let healthChecker: HealthChecker;

    beforeEach(() => {
      healthChecker = new HealthChecker();
    });

    it('should perform health check', async () => {
      const health = await healthChecker.check();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('details');
      expect(health.details).toBeDefined();
      expect(health.details).toHaveProperty('checks');
      expect(Array.isArray(health.details!['checks'])).toBe(true);
    });

    it('should include disk space check', async () => {
      const health = await healthChecker.check();
      
      expect(health).toHaveProperty('details');
      expect(health.details).toBeDefined();
      expect(health.details).toHaveProperty('checks');
      const diskCheck = health.details!['checks'].find((check: any) => check.name === 'diskSpace');
      expect(diskCheck).toBeDefined();
      expect(diskCheck).toHaveProperty('status');
    });

    it('should include process check', async () => {
      const health = await healthChecker.check();
      
      expect(health).toHaveProperty('details');
      expect(health.details).toBeDefined();
      expect(health.details).toHaveProperty('checks');
      const processCheck = health.details!['checks'].find((check: any) => check.name === 'process');
      expect(processCheck).toBeDefined();
      expect(processCheck).toHaveProperty('status');
    });
  });

  describe('InfoCollector', () => {
    let infoCollector: InfoCollector;

    beforeEach(() => {
      infoCollector = new InfoCollector();
    });

    it('should collect application info', async () => {
      const info = await infoCollector.collect();
      
      expect(info).toHaveProperty('app');
      expect(info).toHaveProperty('system');
      expect(info).toHaveProperty('timestamp');
      expect(info.app).toHaveProperty('name');
      expect(info.app).toHaveProperty('version');
      expect(info.app).toHaveProperty('description');
    });
  });

  describe('EnvironmentCollector', () => {
    let envCollector: EnvironmentCollector;

    beforeEach(() => {
      envCollector = new EnvironmentCollector();
    });

    it('should collect environment variables', async () => {
      const env = await envCollector.collect();
      
      expect(env).toHaveProperty('timestamp');
      expect(env).toHaveProperty('environment');
      expect(typeof env.environment).toBe('object');
      expect(env.environment).not.toBeNull();
    });
  });

  describe('Performance', () => {
    it('should collect metrics quickly', async () => {
      const metricsCollector = new MetricsCollector();
      const startTime = Date.now();
      
      await metricsCollector.collect();
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete in less than 100ms
    });

    it('should perform health check quickly', async () => {
      const healthChecker = new HealthChecker();
      const startTime = Date.now();
      
      await healthChecker.check();
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });
});

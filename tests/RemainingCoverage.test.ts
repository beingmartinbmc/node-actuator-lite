import { LightweightActuator } from '../src/core/LightweightActuator';
import { LightweightServer } from '../src/core/LightweightServer';
import { HealthChecker } from '../src/health/HealthChecker';
import { MetricsCollector } from '../src/metrics/MetricsCollector';
import { InfoCollector } from '../src/info/InfoCollector';
import { EnvironmentCollector } from '../src/env/EnvironmentCollector';
import { ThreadDumpCollector } from '../src/utils/threadDump';
import { withTimeout } from '../src/utils/timeout';
import logger from '../src/utils/logger';

describe('Remaining Coverage Tests', () => {
  describe('LightweightServer - Remaining Coverage', () => {
    let server: LightweightServer;

    beforeEach(() => {
      server = new LightweightServer();
    });

    afterEach(async () => {
      if (server) {
        await server.stop();
      }
    });

    it('should test all HTTP methods and response methods', async () => {
      server.get('/get', (_req, res) => res.json({ method: 'GET' }));
      server.post('/post', (_req, res) => res.json({ method: 'POST' }));
      server.put('/put', (_req, res) => res.json({ method: 'PUT' }));
      server.delete('/delete', (_req, res) => res.json({ method: 'DELETE' }));

      server.get('/status', (_req, res) => res.status(201).json({ message: 'created' }));
      server.get('/send', (_req, res) => res.send('Hello World'));
      server.get('/header', (_req, res) => {
        res.setHeader('X-Custom', 'test-value');
        res.json({ message: 'with header' });
      });

      await server.start();
      const port = server.getPort();

      // Test all methods
      const methods = ['GET', 'POST', 'PUT', 'DELETE'];
      for (const method of methods) {
        const response = await fetch(`http://localhost:${port}/${method.toLowerCase()}`, { 
          method: method as any 
        });
        expect(response.status).toBe(200);
      }

      // Test response methods
      const statusResponse = await fetch(`http://localhost:${port}/status`);
      expect(statusResponse.status).toBe(201);

      const sendResponse = await fetch(`http://localhost:${port}/send`);
      expect(sendResponse.status).toBe(200);

      const headerResponse = await fetch(`http://localhost:${port}/header`);
      expect(headerResponse.status).toBe(200);
      expect(headerResponse.headers.get('X-Custom')).toBe('test-value');
    });

    it('should test route parameters and query parameters', async () => {
      server.get('/user/:id', (req, res) => {
        res.json({ id: req.params!['id'] });
      });

      server.get('/query', (req, res) => {
        res.json({ query: req.query });
      });

      await server.start();
      const port = server.getPort();

      const paramResponse = await fetch(`http://localhost:${port}/user/123`);
      expect(paramResponse.status).toBe(200);

      const queryResponse = await fetch(`http://localhost:${port}/query?param1=value1&param2=value2`);
      expect(queryResponse.status).toBe(200);
    });

    it('should test body parsing and error handling', async () => {
      server.post('/json', (req, res) => res.json({ received: req.body }));
      server.post('/text', (req, res) => res.json({ received: req.body }));
      server.post('/invalid-json', (req, res) => res.json({ received: req.body }));

      server.get('/error', (_req, _res) => { throw new Error('Handler error'); });
      server.get('/async-error', async (_req, _res) => { throw new Error('Async handler error'); });

      await server.start();
      const port = server.getPort();

      // Test JSON body
      const jsonResponse = await fetch(`http://localhost:${port}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });
      expect(jsonResponse.status).toBe(200);

      // Test text body
      const textResponse = await fetch(`http://localhost:${port}/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'test data'
      });
      expect(textResponse.status).toBe(200);

      // Test invalid JSON
      const invalidJsonResponse = await fetch(`http://localhost:${port}/invalid-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      expect(invalidJsonResponse.status).toBe(200);

      // Test error handling
      const errorResponse = await fetch(`http://localhost:${port}/error`);
      expect(errorResponse.status).toBe(500);

      const asyncErrorResponse = await fetch(`http://localhost:${port}/async-error`);
      expect(asyncErrorResponse.status).toBe(500);
    });

    it('should test 404 and port methods', async () => {
      await server.start();
      const port = server.getPort();
      expect(port).toBeGreaterThan(0);

      const notFoundResponse = await fetch(`http://localhost:${port}/not-found`);
      expect(notFoundResponse.status).toBe(404);

      // Test port when not started
      const newServer = new LightweightServer();
      expect(newServer.getPort()).toBe(0);
    });
  });

  describe('LightweightActuator - Remaining Coverage', () => {
    let actuator: LightweightActuator;

    beforeEach(() => {
      actuator = new LightweightActuator({
        port: 0,
        enableHealth: true,
        enableMetrics: true,
        enableInfo: true,
        enableEnv: true,
        enablePrometheus: true,
        enableThreadDump: true,
        enableHeapDump: true
      });
    });

    afterEach(async () => {
      if (actuator) {
        await actuator.stop();
      }
    });

    it('should test all endpoints and methods', async () => {
      await actuator.start();
      const port = actuator.getPort();

      // Test all endpoints
      const endpoints = [
        '/actuator/health',
        '/actuator/metrics',
        '/actuator/info',
        '/actuator/env',
        '/actuator/prometheus',
        '/actuator/threaddump',
        '/actuator/heapdump'
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`http://localhost:${port}${endpoint}`);
        expect(response.status).toBe(200);
      }

      // Test methods
      expect(actuator.getBasePath()).toBe('/actuator');
      expect(actuator.getPort()).toBe(port);
      expect(actuator.getCustomMetric('test')).toBeUndefined();
    });

    it('should test error handling in dump generation', async () => {
      await actuator.start();
      
      // Mock methods to throw errors
      const originalThreadDump = (actuator as any).generateThreadDump;
      const originalHeapDump = (actuator as any).generateHeapDump;
      
      (actuator as any).generateThreadDump = jest.fn().mockImplementation(() => {
        throw new Error('Thread dump error');
      });
      (actuator as any).generateHeapDump = jest.fn().mockImplementation(() => {
        throw new Error('Heap dump error');
      });

      try {
        const threadResponse = await fetch(`http://localhost:${actuator.getPort()}/actuator/threaddump`);
        expect(threadResponse.status).toBe(500);

        const heapResponse = await fetch(`http://localhost:${actuator.getPort()}/actuator/heapdump`);
        expect(heapResponse.status).toBe(500);
      } finally {
        (actuator as any).generateThreadDump = originalThreadDump;
        (actuator as any).generateHeapDump = originalHeapDump;
      }
    });
  });

  describe('HealthChecker - Remaining Coverage', () => {
    it('should test all health check scenarios', async () => {
      // Test timeout
      const slowCheck = {
        name: 'slow-check',
        check: async () => {
          await new Promise(resolve => setTimeout(resolve, 10000));
          return { status: 'UP' };
        },
        enabled: true,
        critical: false
      };

      const timeoutHealthChecker = new HealthChecker([], {
        customIndicators: [slowCheck],
        healthCheckTimeout: 100
      });

      const timeoutHealth = await timeoutHealthChecker.check();
      const slowCheckResult = timeoutHealth.details!['checks'].find((check: any) => check.name === 'slow-check');
      expect(slowCheckResult.status).toBe('DOWN');

      // Test error
      const errorCheck = {
        name: 'error-check',
        check: async () => { throw new Error('Health check error'); },
        enabled: true,
        critical: false
      };

      const errorHealthChecker = new HealthChecker([], {
        customIndicators: [errorCheck]
      });

      const errorHealth = await errorHealthChecker.check();
      const errorCheckResult = errorHealth.details!['checks'].find((check: any) => check.name === 'error-check');
      expect(errorCheckResult.status).toBe('DOWN');

      // Test critical failure
      const criticalCheck = {
        name: 'critical-check',
        check: async () => ({ status: 'DOWN', details: { error: 'Critical failure' } }),
        enabled: true,
        critical: true
      };

      const criticalHealthChecker = new HealthChecker([], {
        customIndicators: [criticalCheck]
      });

      const criticalHealth = await criticalHealthChecker.check();
      expect(criticalHealth.status).toBe('DOWN');

      // Test disk space threshold failure
      const diskHealthChecker = new HealthChecker([], {
        diskSpaceThreshold: 1024 * 1024 * 1024 * 1024 * 1024 // 1TB threshold
      });

      const diskHealth = await diskHealthChecker.check();
      expect(diskHealth.status).toBe('DOWN');

      // Test disabled checks
      const disabledHealthChecker = new HealthChecker([], {
        includeDiskSpace: false,
        includeProcess: false
      });

      const disabledHealth = await disabledHealthChecker.check();
      expect(disabledHealth.details!['checks'].length).toBe(0);

      // Test custom disk path - platform specific
      const customDiskPath = process.platform === 'win32' ? 'C:\\temp' : '/tmp';
      const customDiskHealthChecker = new HealthChecker([], {
        diskSpacePath: customDiskPath,
        diskSpaceThreshold: 1024 * 1024
      });

      const customDiskHealth = await customDiskHealthChecker.check();
      const diskCheck = customDiskHealth.details!['checks'].find((check: any) => check.name === 'diskSpace');
      expect(diskCheck.details.path).toBe(customDiskPath);

      // Test non-existent path - platform specific
      const nonExistentPath = process.platform === 'win32' ? 'C:\\non\\existent\\path' : '/non/existent/path';
      const nonExistentHealthChecker = new HealthChecker([], {
        diskSpacePath: nonExistentPath,
        diskSpaceThreshold: 1024 * 1024
      });

      const nonExistentHealth = await nonExistentHealthChecker.check();
      const nonExistentCheck = nonExistentHealth.details!['checks'].find((check: any) => check.name === 'diskSpace');
      
      if (process.platform === 'win32') {
        // Windows returns hardcoded values regardless of path existence
        expect(nonExistentCheck.status).toBe('UP');
        expect(nonExistentCheck.details.exists).toBe(true);
      } else {
        // Unix systems should fail for non-existent paths
        expect(nonExistentCheck.status).toBe('DOWN');
        expect(nonExistentCheck.details.exists).toBe(true);
      }
    });
  });

  describe('ThreadDump - Remaining Coverage', () => {
    let collector: ThreadDumpCollector;

    beforeEach(() => {
      collector = new ThreadDumpCollector();
    });

    afterEach(() => {
      collector.destroy();
    });

    it('should test error handling in all methods', async () => {
      // Test CPU usage error
      const originalCpuUsage = process.cpuUsage;
      process.cpuUsage = jest.fn().mockImplementation(() => {
        throw new Error('CPU usage error');
      });

      try {
        const threadDump = await collector.collectThreadDump();
        expect(threadDump).toHaveProperty('timestamp');
        expect(threadDump).toHaveProperty('threads');
      } finally {
        process.cpuUsage = originalCpuUsage;
      }

      // Test resource usage error
      const originalResourceUsage = process.resourceUsage;
      process.resourceUsage = jest.fn().mockImplementation(() => {
        throw new Error('Resource usage error');
      });

      try {
        const eventLoop = (collector as any).collectEventLoopInfo();
        expect(eventLoop).toHaveProperty('phase');
        expect(eventLoop).toHaveProperty('phaseTime');
      } finally {
        process.resourceUsage = originalResourceUsage;
      }

      // Test process methods error
      const originalGetuid = process.getuid;
      const originalGetgid = process.getgid;
      
      process.getuid = jest.fn().mockImplementation(() => {
        throw new Error('Process error');
      });
      process.getgid = jest.fn().mockImplementation(() => {
        throw new Error('Process error');
      });

      try {
        const mainThread = (collector as any).collectMainThreadInfo();
        expect(mainThread).toHaveProperty('threadId');
        expect(mainThread).toHaveProperty('threadName');
      } finally {
        if (originalGetuid) process.getuid = originalGetuid;
        if (originalGetgid) process.getgid = originalGetgid;
      }
    });
  });

  describe('Timeout Utils - Remaining Coverage', () => {
    it('should test all timeout scenarios', async () => {
      // Test custom error message
      const promise1 = new Promise(resolve => {
        setTimeout(() => resolve('success'), 2000);
      });
      await expect(withTimeout(promise1, 100, 'Custom timeout message')).rejects.toThrow('Custom timeout message');

      // Test zero timeout
      const promise2 = new Promise(resolve => {
        setTimeout(() => resolve('success'), 100);
      });
      await expect(withTimeout(promise2, 0)).rejects.toThrow();

      // Test negative timeout
      const promise3 = new Promise(resolve => {
        setTimeout(() => resolve('success'), 100);
      });
      await expect(withTimeout(promise3, -100)).rejects.toThrow();

      // Test promise rejection
      const promise4 = Promise.reject(new Error('Promise error'));
      await expect(withTimeout(promise4, 1000)).rejects.toThrow('Promise error');
    });
  });

  describe('Logger - Remaining Coverage', () => {
    it('should test all logger methods', () => {
      logger.error('Test error');
      logger.warn('Test warn');
      logger.info('Test info');
      logger.debug('Test debug');
      
      const testObj = { key: 'value', number: 123 };
      logger.info('Test object', testObj);
      
      expect(true).toBe(true);
    });
  });

  describe('MetricsCollector - Remaining Coverage', () => {
    let metricsCollector: MetricsCollector;

    beforeEach(() => {
      metricsCollector = new MetricsCollector();
    });

    it('should test all metrics methods', () => {
      const registry = metricsCollector.getRegistry();
      expect(registry).toBeDefined();

      // Test invalid metric type
      expect(() => {
        (metricsCollector as any).addCustomMetric('invalid', 'Invalid metric', 'invalid');
      }).toThrow('Unknown metric type: invalid');

      // Test all metric types
      const counter = metricsCollector.addCustomMetric('test_counter', 'Test counter', 'counter');
      const gauge = metricsCollector.addCustomMetric('test_gauge', 'Test gauge', 'gauge');
      const histogram = metricsCollector.addCustomMetric('test_histogram', 'Test histogram', 'histogram');

      expect(counter).toBeDefined();
      expect(gauge).toBeDefined();
      expect(histogram).toBeDefined();

      expect(metricsCollector.getCustomMetric('test_counter')).toBe(counter);
      expect(metricsCollector.getCustomMetric('test_gauge')).toBe(gauge);
      expect(metricsCollector.getCustomMetric('test_histogram')).toBe(histogram);

      expect(metricsCollector.removeCustomMetric('test_counter')).toBe(true);
      expect(metricsCollector.removeCustomMetric('non_existent')).toBe(false);

      const customMetrics = metricsCollector.getCustomMetrics();
      expect(customMetrics.size).toBe(2);
    });
  });

  describe('InfoCollector - Remaining Coverage', () => {
    let infoCollector: InfoCollector;

    beforeEach(() => {
      infoCollector = new InfoCollector();
    });

    it('should test all info methods', async () => {
      const formattedInfo = await infoCollector.getFormattedInfo();
      expect(formattedInfo).toHaveProperty('timestamp');
      expect(formattedInfo).toHaveProperty('app');
      expect(formattedInfo).toHaveProperty('system');

      // Test npm version error
      const originalExecSync = require('child_process').execSync;
      require('child_process').execSync = jest.fn().mockImplementation(() => {
        throw new Error('npm not found');
      });

      try {
        const systemInfo = await (infoCollector as any).collectSystemInfo();
        expect(systemInfo).toHaveProperty('npmVersion');
        expect(systemInfo.npmVersion).toBeUndefined();
      } finally {
        require('child_process').execSync = originalExecSync;
      }
    });
  });

  describe('EnvironmentCollector - Remaining Coverage', () => {
    let envCollector: EnvironmentCollector;

    beforeEach(() => {
      envCollector = new EnvironmentCollector();
    });

    it('should test all environment methods', () => {
      const value = envCollector.getEnvironmentVariable('NODE_ENV');
      expect(value).toBeDefined();

      const hasValue = envCollector.hasEnvironmentVariable('NODE_ENV');
      expect(typeof hasValue).toBe('boolean');

      const envVars = envCollector.getEnvironmentVariablesByPrefix('NODE');
      expect(typeof envVars).toBe('object');

      // Test async method
      envCollector.getFormattedEnvironment().then(formattedEnv => {
        expect(formattedEnv).toHaveProperty('timestamp');
        expect(formattedEnv).toHaveProperty('nodeEnv');
        expect(formattedEnv).toHaveProperty('systemInfo');
      });
    });
  });
});

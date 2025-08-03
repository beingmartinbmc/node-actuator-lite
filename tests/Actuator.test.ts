import request from 'supertest';
import { Actuator } from '../src/core/Actuator';

describe('Actuator', () => {
  let actuator: Actuator;
  let server: any;

  beforeEach(() => {
    actuator = new Actuator({
      port: 0, // Use random port for testing
      basePath: '/actuator'
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await actuator.shutdown();
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      expect(actuator.getPort()).toBe(0);
      expect(actuator.getBasePath()).toBe('/actuator');
    });

    test('should initialize with custom options', () => {
      const customActuator = new Actuator({
        port: 3002,
        basePath: '/health',
        enableHealth: false,
        enableMetrics: false
      });

      expect(customActuator.getPort()).toBe(3002);
      expect(customActuator.getBasePath()).toBe('/health');
    });
  });

  describe('Health Check API', () => {
    test('should add health indicator', () => {
      const healthCheck = jest.fn().mockResolvedValue({
        status: 'UP',
        details: { message: 'Test health check' }
      });

      actuator.addHealthIndicator('test', healthCheck);
      const indicators = actuator.getHealthIndicators();
      
      expect(indicators).toContainEqual({
        name: 'test',
        enabled: true,
        critical: false
      });
    });

    test('should add database health check', () => {
      const dbCheck = jest.fn().mockResolvedValue({
        status: 'UP',
        details: { database: 'PostgreSQL' }
      });

      actuator.addDatabaseHealthCheck('postgres', dbCheck);
      const indicators = actuator.getHealthIndicators();
      
      expect(indicators).toContainEqual({
        name: 'postgres',
        enabled: true,
        critical: true
      });
    });

    test('should add cache health check', () => {
      const cacheCheck = jest.fn().mockResolvedValue({
        status: 'UP',
        details: { version: '6.2.0' }
      });

      actuator.addCacheHealthCheck('redis', cacheCheck);
      const indicators = actuator.getHealthIndicators();
      
      expect(indicators).toContainEqual({
        name: 'redis',
        enabled: true,
        critical: false
      });
    });

    test('should remove health indicator', () => {
      const healthCheck = jest.fn();
      actuator.addHealthIndicator('test', healthCheck);
      
      expect(actuator.getHealthIndicators()).toContainEqual({
        name: 'test',
        enabled: true,
        critical: false
      });

      actuator.removeHealthIndicator('test');
      
      expect(actuator.getHealthIndicators()).not.toContainEqual({
        name: 'test',
        enabled: true,
        critical: false
      });
    });
  });

  describe('Metrics API', () => {
    test('should add custom metric', () => {
      const metric = actuator.addCustomMetric('test_counter', 'Test counter metric', 'counter', { labelNames: ['label1', 'label2'] });
      expect(metric).toBeDefined();
      // For counter metrics, the name gets a _total suffix added automatically
      expect(actuator.getCustomMetric('test_counter_total')).toBeDefined();
    });

    test('should add different metric types', () => {
      const counter = actuator.addCustomMetric('counter', 'Counter', 'counter');
      const gauge = actuator.addCustomMetric('gauge', 'Gauge', 'gauge');
      const histogram = actuator.addCustomMetric('histogram', 'Histogram', 'histogram');

      expect(counter).toBeDefined();
      expect(gauge).toBeDefined();
      expect(histogram).toBeDefined();
    });

    test('should throw error for invalid metric type', () => {
      expect(() => {
        actuator.addCustomMetric('invalid', 'Invalid', 'invalid' as any);
      }).toThrow('Unknown metric type: invalid');
    });
  });

  describe('Server Endpoints', () => {
    beforeEach(async () => {
      server = await actuator.start();
    });

    test('should serve root endpoint', async () => {
      const response = await request(actuator.getApp())
        .get('/actuator')
        .expect(200);

      expect(response.body).toHaveProperty('_links');
      expect(response.body._links).toHaveProperty('self');
    });

    test('should serve health endpoint', async () => {
      const response = await request(actuator.getApp())
        .get('/actuator/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('details');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    test('should serve metrics endpoint', async () => {
      const response = await request(actuator.getApp())
        .get('/actuator/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('process');
    });

    test('should serve prometheus endpoint', async () => {
      const response = await request(actuator.getApp())
        .get('/actuator/prometheus')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
    });

    test('should serve info endpoint', async () => {
      const response = await request(actuator.getApp())
        .get('/actuator/info')
        .expect(200);

      expect(response.body).toHaveProperty('app');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should serve env endpoint', async () => {
      const response = await request(actuator.getApp())
        .get('/actuator/env')
        .expect(200);

      expect(response.body).toHaveProperty('nodeEnv');
      expect(response.body).toHaveProperty('platform');
      expect(response.body).toHaveProperty('processEnv');
    });

    test('should serve mappings endpoint', async () => {
      const response = await request(actuator.getApp())
        .get('/actuator/mappings')
        .expect(200);

      expect(response.body).toHaveProperty('context');
      expect(response.body.context).toHaveProperty('mappings');
    });

    test('should serve modules endpoint', async () => {
      const response = await request(actuator.getApp())
        .get('/actuator/modules')
        .expect(200);

      expect(response.body).toHaveProperty('application');
      expect(response.body.application).toHaveProperty('modules');
    });

    test('should serve configprops endpoint', async () => {
      const response = await request(actuator.getApp())
        .get('/actuator/configprops')
        .expect(200);

      expect(response.body).toHaveProperty('contexts');
    });

    test('should serve threaddump endpoint', async () => {
      const response = await request(actuator.getApp())
        .get('/actuator/threaddump')
        .expect(200);

      expect(response.body).toHaveProperty('threads');
      expect(Array.isArray(response.body.threads)).toBe(true);
    });

    test('should serve heapdump endpoint', async () => {
      const response = await request(actuator.getApp())
        .get('/actuator/heapdump')
        .expect(200);

      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('timestamp');
      expect(response.body.metadata).toHaveProperty('processId');
      expect(response.body.metadata).toHaveProperty('memoryUsage');
    });
  });

  describe('Health Check Integration', () => {
    beforeEach(async () => {
      server = await actuator.start();
    });

    test('should include custom health checks in response', async () => {
      const mockHealthCheck = jest.fn().mockResolvedValue({
        status: 'UP',
        details: { message: 'Custom health check passed' }
      });

      actuator.addHealthIndicator('custom', mockHealthCheck);

      const response = await request(actuator.getApp())
        .get('/actuator/health')
        .expect(200);

      const customCheck = response.body.details.checks.find(
        (check: any) => check.name === 'custom'
      );

      expect(customCheck).toBeDefined();
      expect(customCheck.status).toBe('UP');
      expect(customCheck.details.message).toBe('Custom health check passed');
      expect(mockHealthCheck).toHaveBeenCalled();
    });

    test('should handle failing health checks', async () => {
      const failingHealthCheck = jest.fn().mockResolvedValue({
        status: 'DOWN',
        details: { error: 'Connection failed' }
      });

      actuator.addHealthIndicator('failing', failingHealthCheck);

      const response = await request(actuator.getApp())
        .get('/actuator/health')
        .expect(200);

      const failingCheck = response.body.details.checks.find(
        (check: any) => check.name === 'failing'
      );

      expect(failingCheck).toBeDefined();
      expect(failingCheck.status).toBe('DOWN');
      expect(failingCheck.details.error).toBe('Connection failed');
    });

    test('should handle health check exceptions', async () => {
      const throwingHealthCheck = jest.fn().mockRejectedValue(
        new Error('Health check failed')
      );

      actuator.addHealthIndicator('throwing', throwingHealthCheck);

      const response = await request(actuator.getApp())
        .get('/actuator/health')
        .expect(200);

      const throwingCheck = response.body.details.checks.find(
        (check: any) => check.name === 'throwing'
      );

      expect(throwingCheck).toBeDefined();
      expect(throwingCheck.status).toBe('DOWN');
      expect(throwingCheck.details.error).toBe('Health check failed');
    });
  });

  describe('Configuration Options', () => {
    test('should disable health endpoint', async () => {
      const disabledActuator = new Actuator({
        port: 0,
        enableHealth: false
      });

      const app = disabledActuator.getApp();
      const response = await request(app)
        .get('/actuator/health')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should disable metrics endpoint', async () => {
      const disabledActuator = new Actuator({
        port: 0,
        enableMetrics: false
      });

      const app = disabledActuator.getApp();
      const response = await request(app)
        .get('/actuator/metrics')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should disable prometheus endpoint', async () => {
      const disabledActuator = new Actuator({
        port: 0,
        enablePrometheus: false
      });

      const app = disabledActuator.getApp();
      const response = await request(app)
        .get('/actuator/prometheus')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Graceful Shutdown', () => {
    test('should shutdown gracefully', async () => {
      await actuator.shutdown();
      // Should not throw any errors
      expect(true).toBe(true);
    });
  });
}); 
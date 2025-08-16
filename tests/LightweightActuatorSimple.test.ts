import { LightweightActuator } from '../src/core/LightweightActuator';

describe('LightweightActuator - Simple Tests', () => {
  let actuator: LightweightActuator;

  beforeEach(() => {
    // Reset static flags for clean testing
    LightweightActuator.resetDefaultMetricsFlag();
    
    actuator = new LightweightActuator({
      port: 0, // Use dynamic port
      enableHealth: true,
      enableMetrics: true,
      enablePrometheus: true,
      enableInfo: true,
      enableEnv: true,
      customHealthChecks: [
        async () => ({ status: 'UP', details: { custom: 'test' } })
      ],
      customMetrics: [
        { name: 'test_counter', help: 'Test counter', type: 'counter' },
        { name: 'test_gauge', help: 'Test gauge', type: 'gauge' }
      ]
    });
  });

  afterEach(async () => {
    if (actuator) {
      await actuator.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const defaultActuator = new LightweightActuator();
      expect(defaultActuator).toBeDefined();
      expect(defaultActuator.getBasePath()).toBe('/actuator');
    });

    it('should initialize with custom options', () => {
      const customActuator = new LightweightActuator({
        port: 3001,
        basePath: '/monitoring',
        enableHealth: false,
        enableMetrics: false
      });
      expect(customActuator).toBeDefined();
      expect(customActuator.getBasePath()).toBe('/monitoring');
    });
  });

  describe('Custom Metrics', () => {
    it('should register custom metrics', () => {
      const counter = actuator.getCustomMetric('test_counter');
      const gauge = actuator.getCustomMetric('test_gauge');
      
      expect(counter).toBeDefined();
      expect(gauge).toBeDefined();
    });

    it('should allow updating custom metrics', () => {
      const counter = actuator.getCustomMetric('test_counter');
      const gauge = actuator.getCustomMetric('test_gauge');
      
      expect(() => counter.inc()).not.toThrow();
      expect(() => gauge.set(42)).not.toThrow();
    });
  });

  describe('Server Management', () => {
    it('should start and stop server', async () => {
      const testActuator = new LightweightActuator({ port: 0 });
      
      const startPort = await testActuator.start();
      expect(startPort).toBeGreaterThan(0);
      expect(testActuator.getPort()).toBe(startPort);
      
      await testActuator.stop();
    });

    it('should handle graceful shutdown', async () => {
      await expect(actuator.stop()).resolves.not.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate port configuration', () => {
      const actuator = new LightweightActuator({ port: 0 });
      expect(actuator).toBeDefined();
    });

    it('should validate base path configuration', () => {
      const actuator = new LightweightActuator({ basePath: '/custom' });
      expect(actuator.getBasePath()).toBe('/custom');
    });
  });

  describe('Performance', () => {
    it('should start quickly', async () => {
      const startTime = Date.now();
      const testActuator = new LightweightActuator({ port: 0 });
      await testActuator.start();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should start in less than 1 second
      await testActuator.stop();
    });
  });

  describe('Static Methods', () => {
    it('should reset default metrics flag', () => {
      expect(() => LightweightActuator.resetDefaultMetricsFlag()).not.toThrow();
    });
  });
});

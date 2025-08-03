import request from 'supertest';
import express from 'express';
import { ActuatorMiddleware, ActuatorMiddlewareOptions } from '../src/core/ActuatorMiddleware';

describe('ActuatorMiddleware', () => {
  let app: express.Application;
  let actuatorMiddleware: ActuatorMiddleware;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    if (actuatorMiddleware) {
      // Clean up any intervals or timers
      ActuatorMiddleware.resetDefaultMetricsFlag();
    }
  });

  describe('Basic Configuration', () => {
    it('should create middleware with default options', () => {
      const options: ActuatorMiddlewareOptions = {};
      actuatorMiddleware = new ActuatorMiddleware(options);
      
      expect(actuatorMiddleware).toBeDefined();
      expect(actuatorMiddleware.getBasePath()).toBe('/actuator');
    });

    it('should create middleware with custom base path', () => {
      const options: ActuatorMiddlewareOptions = {
        basePath: '/monitoring'
      };
      actuatorMiddleware = new ActuatorMiddleware(options);
      
      expect(actuatorMiddleware.getBasePath()).toBe('/monitoring');
    });

    it('should return a router', () => {
      const options: ActuatorMiddlewareOptions = {};
      actuatorMiddleware = new ActuatorMiddleware(options);
      
      const router = actuatorMiddleware.getRouter();
      expect(router).toBeDefined();
      expect(typeof router.use).toBe('function');
    });
  });

  describe('Health Endpoint', () => {
    beforeEach(() => {
      const options: ActuatorMiddlewareOptions = {
        enableHealth: true
      };
      actuatorMiddleware = new ActuatorMiddleware(options);
      app.use(actuatorMiddleware.getRouter());
    });

    it('should respond to health check', async () => {
      const response = await request(app)
        .get('/actuator/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('details');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should include health indicators', async () => {
      const response = await request(app)
        .get('/actuator/health')
        .expect(200);

      expect(response.body.details).toHaveProperty('checks');
      expect(Array.isArray(response.body.details.checks)).toBe(true);
    });
  });

  describe('Metrics Endpoint', () => {
    beforeEach(() => {
      const options: ActuatorMiddlewareOptions = {
        enableMetrics: true
      };
      actuatorMiddleware = new ActuatorMiddleware(options);
      app.use(actuatorMiddleware.getRouter());
    });

    it('should respond to metrics request', async () => {
      const response = await request(app)
        .get('/actuator/metrics')
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('Info Endpoint', () => {
    beforeEach(() => {
      const options: ActuatorMiddlewareOptions = {
        enableInfo: true
      };
      actuatorMiddleware = new ActuatorMiddleware(options);
      app.use(actuatorMiddleware.getRouter());
    });

    it('should respond to info request', async () => {
      const response = await request(app)
        .get('/actuator/info')
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('Environment Endpoint', () => {
    beforeEach(() => {
      const options: ActuatorMiddlewareOptions = {
        enableEnv: true
      };
      actuatorMiddleware = new ActuatorMiddleware(options);
      app.use(actuatorMiddleware.getRouter());
    });

    it('should respond to environment request', async () => {
      const response = await request(app)
        .get('/actuator/env')
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('Custom Health Indicators', () => {
    beforeEach(() => {
      const options: ActuatorMiddlewareOptions = {
        enableHealth: true,
        customHealthChecks: [
          async () => ({
            status: 'UP',
            details: { custom: 'test' }
          })
        ]
      };
      actuatorMiddleware = new ActuatorMiddleware(options);
      app.use(actuatorMiddleware.getRouter());
    });

    it('should include custom health indicators', async () => {
      const response = await request(app)
        .get('/actuator/health')
        .expect(200);

      expect(response.body.status).toBe('UP');
    });

    it('should allow adding health indicators dynamically', () => {
      actuatorMiddleware.addHealthIndicator('dynamic-test', async () => ({
        status: 'UP',
        details: { dynamic: true }
      }));

      const indicators = actuatorMiddleware.getHealthIndicators();
      expect(indicators.some(indicator => indicator.name === 'dynamic-test')).toBe(true);
    });
  });

  describe('Custom Metrics', () => {
    beforeEach(() => {
      const options: ActuatorMiddlewareOptions = {
        enableMetrics: true,
        customMetrics: [
          { name: 'test_counter', help: 'Test counter', type: 'counter' }
        ]
      };
      actuatorMiddleware = new ActuatorMiddleware(options);
      app.use(actuatorMiddleware.getRouter());
    });

    it('should create custom metrics', () => {
      const metric = actuatorMiddleware.getCustomMetric('test_counter_total');
      expect(metric).toBeDefined();
    });

    it('should allow adding metrics dynamically', () => {
      const metric = actuatorMiddleware.addCustomMetric(
        'dynamic_gauge',
        'Dynamic gauge',
        'gauge'
      );
      expect(metric).toBeDefined();
    });
  });

  describe('Custom Beans and Config Props', () => {
    beforeEach(() => {
      const options: ActuatorMiddlewareOptions = {
        enableBeans: true,
        enableConfigProps: true,
        customBeans: {
          'testBean': { name: 'TestBean', type: 'service', instance: {} }
        },
        customConfigProps: {
          'test.property': 'test-value'
        }
      };
      actuatorMiddleware = new ActuatorMiddleware(options);
      app.use(actuatorMiddleware.getRouter());
    });

    it('should include custom beans', async () => {
      const response = await request(app)
        .get('/actuator/beans')
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should include custom config props', async () => {
      const response = await request(app)
        .get('/actuator/configprops')
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('Disabled Endpoints', () => {
    beforeEach(() => {
      const options: ActuatorMiddlewareOptions = {
        enableHealth: false,
        enableMetrics: false,
        enableInfo: false,
        enableEnv: false
      };
      actuatorMiddleware = new ActuatorMiddleware(options);
      app.use(actuatorMiddleware.getRouter());
    });

    it('should not respond to disabled health endpoint', async () => {
      await request(app)
        .get('/actuator/health')
        .expect(404);
    });

    it('should not respond to disabled metrics endpoint', async () => {
      await request(app)
        .get('/actuator/metrics')
        .expect(404);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      const options: ActuatorMiddlewareOptions = {
        enableHealth: true,
        customHealthChecks: [
          async () => {
            throw new Error('Health check failed');
          }
        ]
      };
      actuatorMiddleware = new ActuatorMiddleware(options);
      app.use(actuatorMiddleware.getRouter());
    });

    it('should handle health check errors gracefully', async () => {
      const response = await request(app)
        .get('/actuator/health')
        .expect(500);

      expect(response.body).toHaveProperty('status', 'DOWN');
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Route Registration', () => {
    beforeEach(() => {
      const options: ActuatorMiddlewareOptions = {};
      actuatorMiddleware = new ActuatorMiddleware(options);
      app.use(actuatorMiddleware.getRouter());
    });

    it('should register custom routes', () => {
      actuatorMiddleware.registerRoute('GET', '/custom', 'Custom Handler');
      actuatorMiddleware.registerCustomRoute('POST', '/custom', 'Custom Post Handler');

      // This would be tested by checking the mappings endpoint
      // but for now we just verify the method doesn't throw
      expect(() => {
        actuatorMiddleware.registerRoute('GET', '/test', 'Test Handler');
      }).not.toThrow();
    });
  });
}); 
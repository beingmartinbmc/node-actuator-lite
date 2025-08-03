import { HealthChecker, HealthCheckerOptions } from '../src/health/HealthChecker';

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;

  beforeEach(() => {
    healthChecker = new HealthChecker();
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      const options = healthChecker.getOptions();
      
      expect(options.includeDiskSpace).toBe(true);
      expect(options.includeProcess).toBe(true);
      expect(options.diskSpaceThreshold).toBe(10 * 1024 * 1024); // 10MB
      expect(options.diskSpacePath).toBe(process.cwd());
    });

    test('should initialize with custom options', () => {
      const customOptions: HealthCheckerOptions = {
        includeDiskSpace: false,
        includeProcess: false,
        diskSpaceThreshold: 50 * 1024 * 1024, // 50MB
        diskSpacePath: '/tmp'
      };

      const customHealthChecker = new HealthChecker([], customOptions);
      const options = customHealthChecker.getOptions();
      
      expect(options.includeDiskSpace).toBe(false);
      expect(options.includeProcess).toBe(false);
      expect(options.diskSpaceThreshold).toBe(50 * 1024 * 1024);
      expect(options.diskSpacePath).toBe('/tmp');
    });
  });

  describe('Health Check Execution', () => {
    test('should perform health check with default indicators', async () => {
      const result = await healthChecker.check();
      
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      
      expect(result.details).toHaveProperty('checks');
      expect(result.details).toHaveProperty('responseTime');
      
      expect(Array.isArray(result.details?.['checks'])).toBe(true);
      expect(result.details?.['checks'].length).toBeGreaterThan(0);
    });

    test('should include disk space check when enabled', async () => {
      const result = await healthChecker.check();
      const diskSpaceCheck = result.details?.['checks'].find(
        (check: any) => check.name === 'diskSpace'
      );
      
      expect(diskSpaceCheck).toBeDefined();
      expect(diskSpaceCheck).toHaveProperty('status');
      expect(diskSpaceCheck).toHaveProperty('details');
    });

    test('should include process check when enabled', async () => {
      const result = await healthChecker.check();
      const processCheck = result.details?.['checks'].find(
        (check: any) => check.name === 'process'
      );
      
      expect(processCheck).toBeDefined();
      expect(processCheck).toHaveProperty('status');
      expect(processCheck).toHaveProperty('details');
    });

    test('should exclude disabled indicators', async () => {
      const disabledHealthChecker = new HealthChecker([], {
        includeDiskSpace: false,
        includeProcess: false
      });

      const result = await disabledHealthChecker.check();
      const diskSpaceCheck = result.details?.['checks'].find(
        (check: any) => check.name === 'diskSpace'
      );
      const processCheck = result.details?.['checks'].find(
        (check: any) => check.name === 'process'
      );
      
      expect(diskSpaceCheck).toBeUndefined();
      expect(processCheck).toBeUndefined();
    });
  });

  describe('Custom Health Indicators', () => {
    test('should add and execute custom health indicator', async () => {
      const mockHealthCheck = jest.fn().mockResolvedValue({
        status: 'UP',
        details: { message: 'Custom check passed' }
      });

      healthChecker.addHealthIndicator({
        name: 'custom',
        check: mockHealthCheck,
        enabled: true,
        critical: false
      });

      const result = await healthChecker.check();
      const customCheck = result.details?.['checks'].find(
        (check: any) => check.name === 'custom'
      );

      expect(customCheck).toBeDefined();
      expect(customCheck.status).toBe('UP');
      expect(customCheck.details.message).toBe('Custom check passed');
      expect(mockHealthCheck).toHaveBeenCalled();
    });

    test('should handle custom health indicator failure', async () => {
      const failingHealthCheck = jest.fn().mockResolvedValue({
        status: 'DOWN',
        details: { error: 'Custom check failed' }
      });

      healthChecker.addHealthIndicator({
        name: 'failing',
        check: failingHealthCheck,
        enabled: true,
        critical: false
      });

      const result = await healthChecker.check();
      const failingCheck = result.details?.['checks'].find(
        (check: any) => check.name === 'failing'
      );

      expect(failingCheck).toBeDefined();
      expect(failingCheck.status).toBe('DOWN');
      expect(failingCheck.details.error).toBe('Custom check failed');
    });

    test('should handle custom health indicator exception', async () => {
      const throwingHealthCheck = jest.fn().mockRejectedValue(
        new Error('Health check exception')
      );

      healthChecker.addHealthIndicator({
        name: 'throwing',
        check: throwingHealthCheck,
        enabled: true,
        critical: false
      });

      const result = await healthChecker.check();
      const throwingCheck = result.details?.['checks'].find(
        (check: any) => check.name === 'throwing'
      );

      expect(throwingCheck).toBeDefined();
      expect(throwingCheck.status).toBe('DOWN');
      expect(throwingCheck.details.error).toBe('Health check exception');
    });

    test('should respect enabled flag for custom indicators', async () => {
      const mockHealthCheck = jest.fn().mockResolvedValue({
        status: 'UP',
        details: { message: 'Should not be called' }
      });

      healthChecker.addHealthIndicator({
        name: 'disabled',
        check: mockHealthCheck,
        enabled: false,
        critical: false
      });

      const result = await healthChecker.check();
      const disabledCheck = result.details?.['checks'].find(
        (check: any) => check.name === 'disabled'
      );

      expect(disabledCheck).toBeUndefined();
      expect(mockHealthCheck).not.toHaveBeenCalled();
    });
  });

  describe('Legacy Custom Health Checks', () => {
    test('should execute legacy custom health checks', async () => {
      const legacyCheck = jest.fn().mockResolvedValue({
        status: 'UP',
        details: { message: 'Legacy check passed' }
      });

      const healthCheckerWithLegacy = new HealthChecker([legacyCheck]);
      const result = await healthCheckerWithLegacy.check();
      
      const legacyCheckResult = result.details?.['checks'].find(
        (check: any) => check.name === 'custom-0'
      );

      expect(legacyCheckResult).toBeDefined();
      expect(legacyCheckResult.status).toBe('UP');
      expect(legacyCheckResult.details.message).toBe('Legacy check passed');
      expect(legacyCheck).toHaveBeenCalled();
    });

    test('should handle multiple legacy custom health checks', async () => {
      const check1 = jest.fn().mockResolvedValue({
        status: 'UP',
        details: { message: 'Check 1 passed' }
      });
      const check2 = jest.fn().mockResolvedValue({
        status: 'DOWN',
        details: { message: 'Check 2 failed' }
      });

      const healthCheckerWithLegacy = new HealthChecker([check1, check2]);
      const result = await healthCheckerWithLegacy.check();
      
      const check1Result = result.details?.['checks'].find(
        (check: any) => check.name === 'custom-0'
      );
      const check2Result = result.details?.['checks'].find(
        (check: any) => check.name === 'custom-1'
      );

      expect(check1Result).toBeDefined();
      expect(check1Result.status).toBe('UP');
      expect(check2Result).toBeDefined();
      expect(check2Result.status).toBe('DOWN');
    });
  });

  describe('Health Status Determination', () => {
    test('should return UP when all checks pass', async () => {
      const result = await healthChecker.check();
      
      // If all built-in checks pass, status should be UP
      const allChecksPass = result.details?.['checks'].every(
        (check: any) => check.status === 'UP'
      );
      
      if (allChecksPass) {
        expect(result.status).toBe('UP');
      }
    });

    test('should return DOWN when critical checks fail', async () => {
      const criticalFailingCheck = jest.fn().mockResolvedValue({
        status: 'DOWN',
        details: { error: 'Critical failure' }
      });

      healthChecker.addHealthIndicator({
        name: 'critical',
        check: criticalFailingCheck,
        enabled: true,
        critical: true
      });

      const result = await healthChecker.check();
      expect(result.status).toBe('DOWN');
    });

    test('should return DOWN when disk space check fails', async () => {
      // Create a health checker with very high disk space threshold
      const highThresholdHealthChecker = new HealthChecker([], {
        diskSpaceThreshold: 1024 * 1024 * 1024 * 1024 // 1TB threshold
      });

      const result = await highThresholdHealthChecker.check();
      expect(result.status).toBe('DOWN');
    });
  });

  describe('Health Indicator Management', () => {
    test('should remove health indicator', () => {
      const mockHealthCheck = jest.fn();
      
      healthChecker.addHealthIndicator({
        name: 'toRemove',
        check: mockHealthCheck,
        enabled: true,
        critical: false
      });

      let indicators = healthChecker.getHealthIndicators();
      expect(indicators).toContainEqual({
        name: 'toRemove',
        enabled: true,
        critical: false
      });

      healthChecker.removeHealthIndicator('toRemove');
      
      indicators = healthChecker.getHealthIndicators();
      expect(indicators).not.toContainEqual({
        name: 'toRemove',
        enabled: true,
        critical: false
      });
    });

    test('should get all health indicators', () => {
      const indicators = healthChecker.getHealthIndicators();
      
      expect(Array.isArray(indicators)).toBe(true);
      expect(indicators.length).toBeGreaterThan(0);
      
      // Should include built-in indicators
      const diskSpaceIndicator = indicators.find(
        (indicator) => indicator.name === 'diskSpace'
      );
      const processIndicator = indicators.find(
        (indicator) => indicator.name === 'process'
      );
      
      expect(diskSpaceIndicator).toBeDefined();
      expect(processIndicator).toBeDefined();
    });

    test('should update options', () => {
      const newOptions = {
        includeDiskSpace: false,
        diskSpaceThreshold: 100 * 1024 * 1024 // 100MB
      };

      healthChecker.updateOptions(newOptions);
      const options = healthChecker.getOptions();
      
      expect(options.includeDiskSpace).toBe(false);
      expect(options.diskSpaceThreshold).toBe(100 * 1024 * 1024);
    });
  });

  describe('Error Handling', () => {
    test('should handle overall health check failure gracefully', async () => {
      // Mock a scenario where health check fails completely
      const mockHealthChecker = new HealthChecker([], {
        includeDiskSpace: false,
        includeProcess: false
      });

      // Add a custom indicator that throws
      mockHealthChecker.addHealthIndicator({
        name: 'throwing',
        check: jest.fn().mockRejectedValue(new Error('Complete failure')),
        enabled: true,
        critical: true
      });

      const result = await mockHealthChecker.check();
      
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      
      // Should still return a valid response even if checks fail
      expect(result.status).toBe('DOWN');
    });
  });
}); 
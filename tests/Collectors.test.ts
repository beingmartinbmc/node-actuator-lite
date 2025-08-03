import { InfoCollector } from '../src/info/InfoCollector';
import { EnvironmentCollector } from '../src/env/EnvironmentCollector';

describe('InfoCollector', () => {
  let infoCollector: InfoCollector;

  beforeEach(() => {
    infoCollector = new InfoCollector();
  });

  describe('Initialization', () => {
    test('should initialize info collector', () => {
      expect(infoCollector).toBeDefined();
    });
  });

  describe('Info Collection', () => {
    test('should collect application info', async () => {
      const info = await infoCollector.collect();
      
      expect(info).toHaveProperty('app');
      expect(info).toHaveProperty('system');
      expect(info).toHaveProperty('timestamp');
    });

    test('should include app information', async () => {
      const info = await infoCollector.collect();
      
      expect(info.app).toHaveProperty('name');
      expect(info.app).toHaveProperty('version');
      expect(info.app).toHaveProperty('description');
      expect(info.app).toHaveProperty('author');
      expect(info.app).toHaveProperty('license');
      
      expect(typeof info.app.name).toBe('string');
      expect(typeof info.app.version).toBe('string');
      expect(typeof info.app.description).toBe('string');
      expect(typeof info.app.author).toBe('string');
      expect(typeof info.app.license).toBe('string');
    });

    test('should include system information', async () => {
      const info = await infoCollector.collect();
      
      expect(info.system).toHaveProperty('hostname');
      expect(info.system).toHaveProperty('platform');
      expect(info.system).toHaveProperty('arch');
      expect(info.system).toHaveProperty('nodeVersion');
      expect(info.system).toHaveProperty('uptime');
      expect(info.system).toHaveProperty('startTime');
      
      expect(typeof info.system.hostname).toBe('string');
      expect(typeof info.system.platform).toBe('string');
      expect(typeof info.system.arch).toBe('string');
      expect(typeof info.system.nodeVersion).toBe('string');
      expect(typeof info.system.uptime).toBe('number');
      expect(typeof info.system.startTime).toBe('string');
    });

    test('should handle missing package.json gracefully', () => {
      // This test verifies that the collector doesn't crash when package.json is missing
      // The actual behavior depends on the current working directory
      expect(() => {
        new InfoCollector();
      }).not.toThrow();
    });
  });

  describe('Formatted Info', () => {
    test('should return formatted info', async () => {
      const formattedInfo = await infoCollector.getFormattedInfo();
      
      expect(formattedInfo).toHaveProperty('timestamp');
      expect(formattedInfo).toHaveProperty('app');
      expect(formattedInfo).toHaveProperty('system');
    });

    test('should format system info correctly', async () => {
      const formattedInfo = await infoCollector.getFormattedInfo();
      
      expect(formattedInfo['system']).toHaveProperty('hostname');
      expect(formattedInfo['system']).toHaveProperty('platform');
      expect(formattedInfo['system']).toHaveProperty('arch');
      expect(formattedInfo['system']).toHaveProperty('nodeVersion');
      expect(formattedInfo['system']).toHaveProperty('uptime');
      expect(formattedInfo['system']).toHaveProperty('startTime');
      
      // Check that uptime is formatted as string with 's'
      expect(typeof formattedInfo['system'].uptime).toBe('string');
      expect(formattedInfo['system'].uptime).toMatch(/^\d+\.\d+s$/);
    });
  });

  describe('Data Validation', () => {
    test('should have valid timestamp format', async () => {
      const info = await infoCollector.collect();
      
      expect(info.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should have positive uptime', async () => {
      const info = await infoCollector.collect();
      
      expect(info.system.uptime).toBeGreaterThan(0);
    });

    test('should have valid start time', async () => {
      const info = await infoCollector.collect();
      
      expect(info.system.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});

describe('EnvironmentCollector', () => {
  let envCollector: EnvironmentCollector;

  beforeEach(() => {
    envCollector = new EnvironmentCollector();
  });

  describe('Initialization', () => {
    test('should initialize environment collector', () => {
      expect(envCollector).toBeDefined();
    });
  });

  describe('Environment Collection', () => {
    test('should collect environment data', async () => {
      const env = await envCollector.collect();
      
      expect(env).toHaveProperty('timestamp');
      expect(env).toHaveProperty('nodeEnv');
      expect(env).toHaveProperty('platform');
      expect(env).toHaveProperty('arch');
      expect(env).toHaveProperty('nodeVersion');
      expect(env).toHaveProperty('processEnv');
      expect(env).toHaveProperty('systemInfo');
    });

    test('should include system information', async () => {
      const env = await envCollector.collect();
      
      expect(env.systemInfo).toHaveProperty('hostname');
      expect(env.systemInfo).toHaveProperty('platform');
      expect(env.systemInfo).toHaveProperty('arch');
      expect(env.systemInfo).toHaveProperty('cpus');
      expect(env.systemInfo).toHaveProperty('totalMemory');
      expect(env.systemInfo).toHaveProperty('freeMemory');
      expect(env.systemInfo).toHaveProperty('uptime');
      
      expect(typeof env.systemInfo.hostname).toBe('string');
      expect(typeof env.systemInfo.platform).toBe('string');
      expect(typeof env.systemInfo.arch).toBe('string');
      expect(typeof env.systemInfo.cpus).toBe('number');
      expect(typeof env.systemInfo.totalMemory).toBe('number');
      expect(typeof env.systemInfo.freeMemory).toBe('number');
      expect(typeof env.systemInfo.uptime).toBe('number');
    });

    test('should include process environment variables', async () => {
      const env = await envCollector.collect();
      
      expect(typeof env.processEnv).toBe('object');
      expect(env.processEnv).toHaveProperty('NODE_ENV');
    });

    test('should filter sensitive environment variables', async () => {
      // Set some sensitive environment variables for testing
      process.env['TEST_PASSWORD'] = 'secret123';
      process.env['TEST_SECRET'] = 'secret456';
      process.env['TEST_API_KEY'] = 'key789';
      process.env['NORMAL_VAR'] = 'normal_value';

      const env = await envCollector.collect();
      
      expect(env.processEnv['TEST_PASSWORD']).toBe('[HIDDEN]');
      expect(env.processEnv['TEST_SECRET']).toBe('[HIDDEN]');
      expect(env.processEnv['TEST_API_KEY']).toBe('[HIDDEN]');
      expect(env.processEnv['NORMAL_VAR']).toBe('normal_value');

      // Clean up
      delete process.env['TEST_PASSWORD'];
      delete process.env['TEST_SECRET'];
      delete process.env['TEST_API_KEY'];
      delete process.env['NORMAL_VAR'];
    });
  });

  describe('Environment Variable Methods', () => {
    test('should get specific environment variable', () => {
      process.env['TEST_VAR'] = 'test_value';
      
      const value = envCollector.getEnvironmentVariable('TEST_VAR');
      expect(value).toBe('test_value');
      
      delete process.env['TEST_VAR'];
    });

    test('should return undefined for non-existent environment variable', () => {
      const value = envCollector.getEnvironmentVariable('NON_EXISTENT_VAR');
      expect(value).toBeUndefined();
    });

    test('should check if environment variable exists', () => {
      process.env['TEST_VAR'] = 'test_value';
      
      expect(envCollector.hasEnvironmentVariable('TEST_VAR')).toBe(true);
      expect(envCollector.hasEnvironmentVariable('NON_EXISTENT_VAR')).toBe(false);
      
      delete process.env['TEST_VAR'];
    });

    test('should get environment variables by prefix', () => {
      process.env['TEST_PREFIX_1'] = 'value1';
      process.env['TEST_PREFIX_2'] = 'value2';
      process.env['OTHER_VAR'] = 'other_value';
      
      const prefixedVars = envCollector.getEnvironmentVariablesByPrefix('TEST_PREFIX_');
      
      expect(prefixedVars).toHaveProperty('TEST_PREFIX_1', 'value1');
      expect(prefixedVars).toHaveProperty('TEST_PREFIX_2', 'value2');
      expect(prefixedVars).not.toHaveProperty('OTHER_VAR');
      
      delete process.env['TEST_PREFIX_1'];
      delete process.env['TEST_PREFIX_2'];
      delete process.env['OTHER_VAR'];
    });

    test('should return empty object for non-existent prefix', () => {
      const prefixedVars = envCollector.getEnvironmentVariablesByPrefix('NON_EXISTENT_PREFIX_');
      expect(prefixedVars).toEqual({});
    });
  });

  describe('Formatted Environment', () => {
    test('should return formatted environment', async () => {
      const formattedEnv = await envCollector.getFormattedEnvironment();
      
      expect(formattedEnv).toHaveProperty('timestamp');
      expect(formattedEnv).toHaveProperty('nodeEnv');
      expect(formattedEnv).toHaveProperty('platform');
      expect(formattedEnv).toHaveProperty('arch');
      expect(formattedEnv).toHaveProperty('nodeVersion');
      expect(formattedEnv).toHaveProperty('systemInfo');
      expect(formattedEnv).toHaveProperty('processEnv');
    });

    test('should format system info correctly', async () => {
      const formattedEnv = await envCollector.getFormattedEnvironment();
      
      expect(formattedEnv['systemInfo']).toHaveProperty('hostname');
      expect(formattedEnv['systemInfo']).toHaveProperty('platform');
      expect(formattedEnv['systemInfo']).toHaveProperty('arch');
      expect(formattedEnv['systemInfo']).toHaveProperty('cpus');
      expect(formattedEnv['systemInfo']).toHaveProperty('totalMemory');
      expect(formattedEnv['systemInfo']).toHaveProperty('freeMemory');
      expect(formattedEnv['systemInfo']).toHaveProperty('uptime');
      
      // Check that memory values are formatted as strings with GB
      expect(typeof formattedEnv['systemInfo'].totalMemory).toBe('string');
      expect(typeof formattedEnv['systemInfo'].freeMemory).toBe('string');
      expect(formattedEnv['systemInfo'].totalMemory).toMatch(/^\d+\.\d+ GB$/);
      expect(formattedEnv['systemInfo'].freeMemory).toMatch(/^\d+\.\d+ GB$/);
      
      // Check that uptime is formatted as string with 's'
      expect(typeof formattedEnv['systemInfo'].uptime).toBe('string');
      expect(formattedEnv['systemInfo'].uptime).toMatch(/^\d+\.\d+s$/);
    });
  });

  describe('Data Validation', () => {
    test('should have valid timestamp format', async () => {
      const env = await envCollector.collect();
      
      expect(env.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should have valid node environment', async () => {
      const env = await envCollector.collect();
      
      expect(typeof env.nodeEnv).toBe('string');
      expect(['development', 'production', 'test']).toContain(env.nodeEnv);
    });

    test('should have valid platform information', async () => {
      const env = await envCollector.collect();
      
      expect(typeof env.platform).toBe('string');
      expect(['darwin', 'linux', 'win32']).toContain(env.platform);
    });

    test('should have valid architecture', async () => {
      const env = await envCollector.collect();
      
      expect(typeof env.arch).toBe('string');
      expect(['x64', 'arm64', 'ia32']).toContain(env.arch);
    });

    test('should have valid system info values', async () => {
      const env = await envCollector.collect();
      
      expect(env.systemInfo.cpus).toBeGreaterThan(0);
      expect(env.systemInfo.totalMemory).toBeGreaterThan(0);
      expect(env.systemInfo.freeMemory).toBeGreaterThanOrEqual(0);
      expect(env.systemInfo.uptime).toBeGreaterThan(0);
    });
  });
}); 
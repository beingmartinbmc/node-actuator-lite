import { EnvironmentCollector } from '../src/env/EnvironmentCollector';

describe('Environment Variable Masking Tests', () => {
  let envCollector: EnvironmentCollector;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables for testing
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Default Masking Behavior', () => {
    beforeEach(() => {
      envCollector = new EnvironmentCollector();
    });

    it('should mask sensitive environment variables by default', async () => {
      // Set up test environment variables
      process.env['DATABASE_PASSWORD'] = 'secret123';
      process.env['API_KEY'] = 'sk-123456789';
      process.env['JWT_SECRET'] = 'my-secret-key';
      process.env['NORMAL_VAR'] = 'visible-value';
      process.env['APP_NAME'] = 'MyApp';

      const result = await envCollector.collect();

      expect(result.environment['DATABASE_PASSWORD']).toBe('[HIDDEN]');
      expect(result.environment['API_KEY']).toBe('[HIDDEN]');
      expect(result.environment['JWT_SECRET']).toBe('[HIDDEN]');
      expect(result.environment['NORMAL_VAR']).toBe('visible-value');
      expect(result.environment['APP_NAME']).toBe('MyApp');
    });

    it('should include masked count information', async () => {
      // Clear any existing environment variables that might interfere
      delete process.env['PASSWORD'];
      delete process.env['SECRET_KEY'];
      
      process.env['PASSWORD'] = 'secret';
      process.env['SECRET_KEY'] = 'hidden';

      const result = await envCollector.collect();

      const maskedCount = parseInt(result.environment['_MASKED_VARIABLES_COUNT'] || '0');
      expect(maskedCount).toBeGreaterThanOrEqual(2);
      expect(result.environment['_MASKED_PATTERNS']).toContain('PASSWORD');
      expect(result.environment['_MASKED_PATTERNS']).toContain('SECRET');
    });
  });

  describe('Custom Masking Configuration', () => {
    it('should use custom mask patterns', async () => {
      envCollector = new EnvironmentCollector({
        maskPatterns: ['CUSTOM', 'SPECIAL'],
        maskValue: '***MASKED***'
      });

      process.env['CUSTOM_VAR'] = 'should-be-masked';
      process.env['SPECIAL_KEY'] = 'also-masked';
      process.env['NORMAL_VAR'] = 'visible';

      const result = await envCollector.collect();

      expect(result.environment['CUSTOM_VAR']).toBe('***MASKED***');
      expect(result.environment['SPECIAL_KEY']).toBe('***MASKED***');
      expect(result.environment['NORMAL_VAR']).toBe('visible');
    });

    it('should mask specific custom variables', async () => {
      envCollector = new EnvironmentCollector({
        maskCustomVariables: ['MY_SPECIFIC_VAR', 'ANOTHER_ONE'],
        maskValue: '🔒 HIDDEN 🔒',
        maskPatterns: [] // Disable default patterns
      });

      process.env['MY_SPECIFIC_VAR'] = 'sensitive-data';
      process.env['ANOTHER_ONE'] = 'more-sensitive';
      process.env['PASSWORD'] = 'should-not-be-masked'; // Not in custom list

      const result = await envCollector.collect();

      expect(result.environment['MY_SPECIFIC_VAR']).toBe('🔒 HIDDEN 🔒');
      expect(result.environment['ANOTHER_ONE']).toBe('🔒 HIDDEN 🔒');
      expect(result.environment['PASSWORD']).toBe('should-not-be-masked');
    });

    it('should combine pattern and custom variable masking', async () => {
      envCollector = new EnvironmentCollector({
        maskPatterns: ['SECRET'],
        maskCustomVariables: ['CUSTOM_VAR'],
        maskValue: '***'
      });

      process.env['SECRET_KEY'] = 'pattern-masked';
      process.env['CUSTOM_VAR'] = 'custom-masked';
      process.env['NORMAL_VAR'] = 'visible';

      const result = await envCollector.collect();

      expect(result.environment['SECRET_KEY']).toBe('***');
      expect(result.environment['CUSTOM_VAR']).toBe('***');
      expect(result.environment['NORMAL_VAR']).toBe('visible');
    });

    it('should disable masked count information', async () => {
      envCollector = new EnvironmentCollector({
        showMaskedCount: false
      });

      process.env['PASSWORD'] = 'secret';

      const result = await envCollector.collect();

      expect(result.environment['PASSWORD']).toBe('[HIDDEN]');
      expect(result.environment['_MASKED_VARIABLES_COUNT']).toBeUndefined();
      expect(result.environment['_MASKED_PATTERNS']).toBeUndefined();
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      envCollector = new EnvironmentCollector();
    });

    it('should add mask patterns dynamically', async () => {
      envCollector.addMaskPattern('CUSTOM');

      process.env['CUSTOM_VAR'] = 'should-be-masked';
      process.env['NORMAL_VAR'] = 'visible';

      const result = await envCollector.collect();

      expect(result.environment['CUSTOM_VAR']).toBe('[HIDDEN]');
      expect(result.environment['NORMAL_VAR']).toBe('visible');
    });

    it('should add custom mask variables dynamically', async () => {
      envCollector.addCustomMaskVariable('SPECIFIC_VAR');

      process.env['SPECIFIC_VAR'] = 'should-be-masked';
      process.env['PASSWORD'] = 'should-not-be-masked'; // Not in custom list

      const result = await envCollector.collect();

      expect(result.environment['SPECIFIC_VAR']).toBe('[HIDDEN]');
      expect(result.environment['PASSWORD']).toBe('[HIDDEN]'); // Still masked by pattern
    });

    it('should remove mask patterns', async () => {
      envCollector.removeMaskPattern('PASSWORD');

      process.env['PASSWORD'] = 'should-be-visible';
      process.env['SECRET'] = 'should-still-be-masked';

      const result = await envCollector.collect();

      expect(result.environment['PASSWORD']).toBe('should-be-visible');
      expect(result.environment['SECRET']).toBe('[HIDDEN]');
    });

    it('should remove custom mask variables', async () => {
      envCollector.addCustomMaskVariable('CUSTOM_VAR');
      envCollector.removeCustomMaskVariable('CUSTOM_VAR');

      process.env['CUSTOM_VAR'] = 'should-be-visible';

      const result = await envCollector.collect();

      expect(result.environment['CUSTOM_VAR']).toBe('should-be-visible');
    });

    it('should get current mask patterns', () => {
      const patterns = envCollector.getMaskPatterns();
      expect(patterns).toContain('PASSWORD');
      expect(patterns).toContain('SECRET');
      expect(patterns).toContain('API_KEY');
    });

    it('should get current custom mask variables', () => {
      envCollector.addCustomMaskVariable('TEST_VAR');
      const customVars = envCollector.getCustomMaskVariables();
      expect(customVars).toContain('TEST_VAR');
    });

    it('should set and get mask value', () => {
      envCollector.setMaskValue('🔒 SECRET 🔒');
      expect(envCollector.getMaskValue()).toBe('🔒 SECRET 🔒');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle database connection strings', async () => {
      envCollector = new EnvironmentCollector({
        maskPatterns: ['DATABASE_URL', 'REDIS_URL', 'MONGODB_URI']
      });

      process.env['DATABASE_URL'] = 'postgresql://user:pass@localhost:5432/db';
      process.env['REDIS_URL'] = 'redis://:password@localhost:6379';
      process.env['MONGODB_URI'] = 'mongodb://user:pass@localhost:27017/db';
      process.env['APP_PORT'] = '3000';

      const result = await envCollector.collect();

      expect(result.environment['DATABASE_URL']).toBe('[HIDDEN]');
      expect(result.environment['REDIS_URL']).toBe('[HIDDEN]');
      expect(result.environment['MONGODB_URI']).toBe('[HIDDEN]');
      expect(result.environment['APP_PORT']).toBe('3000');
    });

    it('should handle API keys and tokens', async () => {
      envCollector = new EnvironmentCollector({
        maskPatterns: ['API_KEY', 'TOKEN', 'SECRET']
      });

      process.env['STRIPE_API_KEY'] = 'sk_test_123456789';
      process.env['JWT_TOKEN'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      process.env['SESSION_SECRET'] = 'my-super-secret-key';
      process.env['APP_ENV'] = 'production';

      const result = await envCollector.collect();

      expect(result.environment['STRIPE_API_KEY']).toBe('[HIDDEN]');
      expect(result.environment['JWT_TOKEN']).toBe('[HIDDEN]');
      expect(result.environment['SESSION_SECRET']).toBe('[HIDDEN]');
      expect(result.environment['APP_ENV']).toBe('production');
    });

    it('should handle case-insensitive matching', async () => {
      envCollector = new EnvironmentCollector({
        maskPatterns: ['password', 'SECRET']
      });

      process.env['DATABASE_PASSWORD'] = 'secret123';
      process.env['db_password'] = 'another-secret';
      process.env['MY_SECRET_KEY'] = 'hidden-key';
      process.env['normal_var'] = 'visible';

      const result = await envCollector.collect();

      expect(result.environment['DATABASE_PASSWORD']).toBe('[HIDDEN]');
      expect(result.environment['db_password']).toBe('[HIDDEN]');
      expect(result.environment['MY_SECRET_KEY']).toBe('[HIDDEN]');
      expect(result.environment['normal_var']).toBe('visible');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined environment variables', async () => {
      envCollector = new EnvironmentCollector();
      
      // Explicitly set undefined
      process.env['UNDEFINED_VAR'] = undefined as any;

      const result = await envCollector.collect();

      expect(result.environment['UNDEFINED_VAR']).toBeUndefined();
    });

    it('should handle empty strings', async () => {
      envCollector = new EnvironmentCollector();

      process.env['EMPTY_VAR'] = '';
      process.env['EMPTY_PASSWORD'] = '';

      const result = await envCollector.collect();

      expect(result.environment['EMPTY_VAR']).toBe('');
      expect(result.environment['EMPTY_PASSWORD']).toBe('[HIDDEN]');
    });

    it('should handle special characters in variable names', async () => {
      envCollector = new EnvironmentCollector({
        maskCustomVariables: ['VAR_WITH_UNDERSCORES', 'VAR-WITH-DASHES']
      });

      process.env['VAR_WITH_UNDERSCORES'] = 'masked';
      process.env['VAR-WITH-DASHES'] = 'also-masked';
      process.env['NORMAL_VAR'] = 'visible';

      const result = await envCollector.collect();

      expect(result.environment['VAR_WITH_UNDERSCORES']).toBe('[HIDDEN]');
      expect(result.environment['VAR-WITH-DASHES']).toBe('[HIDDEN]');
      expect(result.environment['NORMAL_VAR']).toBe('visible');
    });
  });
});

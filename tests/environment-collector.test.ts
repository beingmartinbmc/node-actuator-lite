import { EnvironmentCollector, DEFAULT_MASK_PATTERNS } from '../src/collectors/EnvironmentCollector';
import type { ResolvedActuatorOptions } from '../src/core/types';

function makeConfig(
  overrides: Partial<ResolvedActuatorOptions['env']> = {},
): ResolvedActuatorOptions['env'] {
  return {
    enabled: true,
    mask: {
      patterns: ['PASSWORD', 'SECRET'],
      additional: [],
      replacement: '******',
    },
    ...overrides,
  };
}

describe('EnvironmentCollector', () => {
  // ===========================================================================
  // collect()
  // ===========================================================================

  test('collect() returns activeProfiles and propertySources', () => {
    const ec = new EnvironmentCollector(makeConfig());
    const result = ec.collect();

    expect(result.activeProfiles).toBeDefined();
    expect(Array.isArray(result.activeProfiles)).toBe(true);
    expect(result.propertySources.length).toBe(2);

    const names = result.propertySources.map((s) => s.name);
    expect(names).toContain('systemEnvironment');
    expect(names).toContain('systemProperties');
  });

  test('activeProfiles defaults to NODE_ENV or "default"', () => {
    const original = process.env['NODE_ENV'];

    process.env['NODE_ENV'] = 'production';
    const ec1 = new EnvironmentCollector(makeConfig());
    expect(ec1.collect().activeProfiles).toEqual(['production']);

    delete process.env['NODE_ENV'];
    const ec2 = new EnvironmentCollector(makeConfig());
    expect(ec2.collect().activeProfiles).toEqual(['default']);

    // restore
    if (original !== undefined) {
      process.env['NODE_ENV'] = original;
    }
  });

  test('systemProperties contains expected keys', () => {
    const ec = new EnvironmentCollector(makeConfig());
    const sp = ec.collect().propertySources.find((s) => s.name === 'systemProperties')!;

    expect(sp.properties['node.version']).toBeDefined();
    expect(sp.properties['node.platform']).toBeDefined();
    expect(sp.properties['node.arch']).toBeDefined();
    expect(sp.properties['os.hostname']).toBeDefined();
    expect(sp.properties['os.type']).toBeDefined();
    expect(sp.properties['os.release']).toBeDefined();
    expect(sp.properties['os.cpus']).toBeDefined();
    expect(sp.properties['os.totalMemory']).toBeDefined();
    expect(sp.properties['os.freeMemory']).toBeDefined();
    expect(sp.properties['process.pid']).toBeDefined();
    expect(sp.properties['process.uptime']).toBeDefined();
    expect(sp.properties['process.cwd']).toBeDefined();
  });

  test('systemEnvironment includes actual env vars', () => {
    process.env['__TEST_VISIBLE_VAR__'] = 'visible';
    const ec = new EnvironmentCollector(makeConfig());
    const se = ec.collect().propertySources.find((s) => s.name === 'systemEnvironment')!;
    expect(se.properties['__TEST_VISIBLE_VAR__']!.value).toBe('visible');
    delete process.env['__TEST_VISIBLE_VAR__'];
  });

  // ===========================================================================
  // Masking
  // ===========================================================================

  test('masks variables matching pattern (case-insensitive)', () => {
    process.env['DB_PASSWORD'] = 'secret123';
    process.env['my_secret_key'] = 'abc';
    const ec = new EnvironmentCollector(makeConfig());
    const se = ec.collect().propertySources.find((s) => s.name === 'systemEnvironment')!;

    expect(se.properties['DB_PASSWORD']!.value).toBe('******');
    expect(se.properties['my_secret_key']!.value).toBe('******');

    delete process.env['DB_PASSWORD'];
    delete process.env['my_secret_key'];
  });

  test('masks variables listed in additional', () => {
    process.env['SAFE_LOOKING_VAR'] = 'actually-sensitive';
    const ec = new EnvironmentCollector(
      makeConfig({ mask: { patterns: [], additional: ['SAFE_LOOKING_VAR'], replacement: '[HIDDEN]' } }),
    );
    const se = ec.collect().propertySources.find((s) => s.name === 'systemEnvironment')!;
    expect(se.properties['SAFE_LOOKING_VAR']!.value).toBe('[HIDDEN]');
    delete process.env['SAFE_LOOKING_VAR'];
  });

  test('non-sensitive variables are not masked', () => {
    process.env['__PLAIN_VAR__'] = 'hello';
    const ec = new EnvironmentCollector(makeConfig());
    const se = ec.collect().propertySources.find((s) => s.name === 'systemEnvironment')!;
    expect(se.properties['__PLAIN_VAR__']!.value).toBe('hello');
    delete process.env['__PLAIN_VAR__'];
  });

  test('custom replacement string is used', () => {
    process.env['API_PASSWORD'] = 'xyz';
    const ec = new EnvironmentCollector(
      makeConfig({ mask: { patterns: ['PASSWORD'], additional: [], replacement: '🔒' } }),
    );
    const se = ec.collect().propertySources.find((s) => s.name === 'systemEnvironment')!;
    expect(se.properties['API_PASSWORD']!.value).toBe('🔒');
    delete process.env['API_PASSWORD'];
  });

  // ===========================================================================
  // variable()
  // ===========================================================================

  test('variable() returns value for existing var', () => {
    process.env['__LOOKUP_TEST__'] = 'found';
    const ec = new EnvironmentCollector(makeConfig());
    const v = ec.variable('__LOOKUP_TEST__');
    expect(v).toEqual({ name: '__LOOKUP_TEST__', value: 'found' });
    delete process.env['__LOOKUP_TEST__'];
  });

  test('variable() returns null for missing var', () => {
    const ec = new EnvironmentCollector(makeConfig());
    expect(ec.variable('__DOES_NOT_EXIST_XYZ__')).toBeNull();
  });

  test('variable() masks sensitive var', () => {
    process.env['MY_SECRET'] = 'hidden';
    const ec = new EnvironmentCollector(makeConfig());
    const v = ec.variable('MY_SECRET');
    expect(v!.value).toBe('******');
    delete process.env['MY_SECRET'];
  });

  test('variable() masks var listed in additional', () => {
    process.env['SPECIAL'] = 'value';
    const ec = new EnvironmentCollector(
      makeConfig({ mask: { patterns: [], additional: ['SPECIAL'], replacement: '***' } }),
    );
    expect(ec.variable('SPECIAL')!.value).toBe('***');
    delete process.env['SPECIAL'];
  });

  // ===========================================================================
  // Runtime masking management
  // ===========================================================================

  test('addMaskPattern() adds new pattern', () => {
    const ec = new EnvironmentCollector(makeConfig());
    ec.addMaskPattern('STRIPE');
    expect(ec.getMaskPatterns()).toContain('STRIPE');
  });

  test('addMaskPattern() does not duplicate', () => {
    const ec = new EnvironmentCollector(makeConfig());
    ec.addMaskPattern('PASSWORD');
    const count = ec.getMaskPatterns().filter((p) => p === 'PASSWORD').length;
    expect(count).toBe(1);
  });

  test('addMaskVariable() adds specific name', () => {
    process.env['MY_SPECIAL'] = 'hidden';
    const ec = new EnvironmentCollector(makeConfig());

    // Before: not masked
    expect(ec.variable('MY_SPECIAL')!.value).toBe('hidden');

    ec.addMaskVariable('MY_SPECIAL');
    expect(ec.variable('MY_SPECIAL')!.value).toBe('******');

    delete process.env['MY_SPECIAL'];
  });

  test('addMaskVariable() does not duplicate', () => {
    const ec = new EnvironmentCollector(
      makeConfig({ mask: { patterns: [], additional: ['X'], replacement: '***' } }),
    );
    ec.addMaskVariable('X');
    // No error, still one entry
  });

  test('removeMaskPattern() removes pattern', () => {
    const ec = new EnvironmentCollector(makeConfig());
    ec.removeMaskPattern('PASSWORD');
    expect(ec.getMaskPatterns()).not.toContain('PASSWORD');

    process.env['DB_PASSWORD'] = 'visible-now';
    expect(ec.variable('DB_PASSWORD')!.value).toBe('visible-now');
    delete process.env['DB_PASSWORD'];
  });

  test('getMaskPatterns() returns a copy', () => {
    const ec = new EnvironmentCollector(makeConfig());
    const patterns = ec.getMaskPatterns();
    patterns.push('SHOULD_NOT_AFFECT');
    expect(ec.getMaskPatterns()).not.toContain('SHOULD_NOT_AFFECT');
  });

  // ===========================================================================
  // DEFAULT_MASK_PATTERNS export
  // ===========================================================================

  test('DEFAULT_MASK_PATTERNS contains expected values', () => {
    expect(DEFAULT_MASK_PATTERNS).toContain('PASSWORD');
    expect(DEFAULT_MASK_PATTERNS).toContain('SECRET');
    expect(DEFAULT_MASK_PATTERNS).toContain('TOKEN');
    expect(DEFAULT_MASK_PATTERNS).toContain('KEY');
    expect(DEFAULT_MASK_PATTERNS).toContain('AUTH');
    expect(DEFAULT_MASK_PATTERNS).toContain('CREDENTIAL');
    expect(DEFAULT_MASK_PATTERNS).toContain('PRIVATE');
    expect(DEFAULT_MASK_PATTERNS).toContain('SIGNATURE');
  });
});

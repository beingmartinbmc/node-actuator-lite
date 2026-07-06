import { EnvironmentCollector } from '../src/collectors/EnvironmentCollector';
import type { ResolvedActuatorOptions } from '../src/core/types';

function makeConfig(
  overrides: Partial<ResolvedActuatorOptions['env']> = {},
): ResolvedActuatorOptions['env'] {
  return {
    enabled: true,
    showDetails: 'always',
    mask: {
      patterns: ['PASSWORD', 'SECRET', 'KEY', 'TOKEN'],
      additional: [],
      replacement: '******',
      ...overrides.mask,
    },
    ...overrides,
  } as any;
}

describe('EnvironmentCollector — connection string masking', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('masks password in MongoDB connection string', () => {
    process.env['MONGO_URI'] = 'mongodb://admin:s3cr3t@db.host.com:27017/mydb';
    const collector = new EnvironmentCollector(makeConfig());
    const result = collector.variable('MONGO_URI');

    expect(result).not.toBeNull();
    expect(result!.value).not.toContain('s3cr3t');
    expect(result!.value).toContain('db.host.com');
    expect(result!.value).toContain('27017');
    expect(result!.value).toContain('mydb');
    expect(result!.value).toContain('******');
  });

  test('masks password in PostgreSQL connection string', () => {
    process.env['PG_URL'] = 'postgres://user:mypassword@pg.example.com:5432/production';
    const collector = new EnvironmentCollector(makeConfig());
    const result = collector.variable('PG_URL');

    expect(result!.value).not.toContain('mypassword');
    expect(result!.value).toContain('pg.example.com');
    expect(result!.value).toContain('5432');
    expect(result!.value).toContain('production');
  });

  test('masks password in Redis connection string', () => {
    process.env['REDIS_URL'] = 'redis://default:topsecret@redis.cloud.io:6379';
    const collector = new EnvironmentCollector(makeConfig());
    const result = collector.variable('REDIS_URL');

    expect(result!.value).not.toContain('topsecret');
    expect(result!.value).toContain('redis.cloud.io');
    expect(result!.value).toContain('6379');
  });

  test('masks password in MySQL connection string', () => {
    process.env['MYSQL_URL'] = 'mysql://root:rootpw@mysql.local:3306/app_db';
    const collector = new EnvironmentCollector(makeConfig());
    const result = collector.variable('MYSQL_URL');

    expect(result!.value).not.toContain('rootpw');
    expect(result!.value).toContain('mysql.local');
    expect(result!.value).toContain('3306');
  });

  test('does NOT mask URIs without credentials', () => {
    process.env['SAFE_URL'] = 'https://api.example.com/v1/data';
    const collector = new EnvironmentCollector(makeConfig());
    const result = collector.variable('SAFE_URL');

    expect(result!.value).toBe('https://api.example.com/v1/data');
  });

  test('fully masks when key matches pattern even without URI', () => {
    process.env['DB_PASSWORD'] = 'plaintext-secret';
    const collector = new EnvironmentCollector(makeConfig());
    const result = collector.variable('DB_PASSWORD');

    expect(result!.value).toBe('******');
  });

  test('masks key-matching values that are also URIs with smart masking', () => {
    process.env['DATABASE_SECRET'] = 'postgres://admin:pw123@host:5432/db';
    const collector = new EnvironmentCollector(makeConfig());
    const result = collector.variable('DATABASE_SECRET');

    // Key matches SECRET pattern, but since it's a URI, smart-mask should
    // preserve host info while masking password
    expect(result!.value).not.toContain('pw123');
    expect(result!.value).toContain('host');
  });

  test('masks mongodb+srv:// connections', () => {
    process.env['ATLAS_URI'] = 'mongodb+srv://user:atlaspass@cluster0.abc.mongodb.net/test';
    const collector = new EnvironmentCollector(makeConfig());
    const result = collector.variable('ATLAS_URI');

    expect(result!.value).not.toContain('atlaspass');
    expect(result!.value).toContain('cluster0.abc.mongodb.net');
  });

  test('handles non-URL values with scheme prefix gracefully', () => {
    process.env['WEIRD_VAL'] = 'http://not a valid url at all !@#$';
    const collector = new EnvironmentCollector(makeConfig());
    // Should not crash
    const result = collector.variable('WEIRD_VAL');
    expect(result).not.toBeNull();
  });
});

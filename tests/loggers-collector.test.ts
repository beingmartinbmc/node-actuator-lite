import {
  LoggersCollector,
  PinoLoggerAdapter,
  WinstonLoggerAdapter,
  BunyanLoggerAdapter,
} from '../src/collectors/LoggersCollector';

describe('LoggersCollector', () => {
  test('collect() returns the builtin ROOT logger', () => {
    const lc = new LoggersCollector();
    const result = lc.collect();

    expect(result.levels).toEqual(['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'OFF']);
    expect(result.loggers['ROOT']).toBeDefined();
    expect(result.loggers['ROOT']!.effectiveLevel).toBeDefined();
  });

  test('getLogger() returns info for ROOT', () => {
    const lc = new LoggersCollector();
    const info = lc.getLogger('ROOT');
    expect(info).not.toBeNull();
    expect(info!.effectiveLevel).toBe('WARN');
  });

  test('getLogger() returns null for unknown logger', () => {
    const lc = new LoggersCollector();
    expect(lc.getLogger('nonexistent')).toBeNull();
  });

  test('setLevel() changes the builtin logger level', () => {
    const lc = new LoggersCollector();
    const ok = lc.setLevel('ROOT', 'DEBUG');
    expect(ok).toBe(true);

    const info = lc.getLogger('ROOT');
    expect(info!.configuredLevel).toBe('DEBUG');
    expect(info!.effectiveLevel).toBe('DEBUG');

    // Restore
    lc.setLevel('ROOT', 'WARN');
  });

  test('setLevel() with OFF sets silent', () => {
    const lc = new LoggersCollector();
    expect(lc.setLevel('ROOT', 'OFF')).toBe(true);
    const info = lc.getLogger('ROOT');
    expect(info!.configuredLevel).toBe('OFF');
    // Restore
    lc.setLevel('ROOT', 'WARN');
  });

  test('setLevel() with an invalid level returns false and leaves level unchanged', () => {
    const lc = new LoggersCollector();
    expect(lc.setLevel('ROOT', 'BOGUS' as any)).toBe(false);
    expect(lc.getLogger('ROOT')!.effectiveLevel).toBe('WARN');
  });

  test('getLogger() resolves a colon-qualified name against the builtin adapter', () => {
    const lc = new LoggersCollector();
    expect(lc.getLogger('builtin:ROOT')).not.toBeNull();
  });

  test('getLogger() returns null for a colon-qualified unknown adapter', () => {
    const lc = new LoggersCollector();
    expect(lc.getLogger('nope:ROOT')).toBeNull();
  });

  test('getLogger() returns null for a colon-qualified known adapter but unknown logger', () => {
    const lc = new LoggersCollector();
    expect(lc.getLogger('builtin:nope')).toBeNull();
  });

  test('setLevel() returns false for an unknown logger name', () => {
    const lc = new LoggersCollector();
    expect(lc.setLevel('nonexistent', 'DEBUG')).toBe(false);
  });
});

describe('BuiltinLoggerAdapter env level detection', () => {
  const originalEnv = process.env['ACTUATOR_LOG_LEVEL'];

  afterEach(() => {
    if (originalEnv === undefined) delete process.env['ACTUATOR_LOG_LEVEL'];
    else process.env['ACTUATOR_LOG_LEVEL'] = originalEnv;
  });

  test('maps ACTUATOR_LOG_LEVEL=SILENT to OFF', () => {
    jest.resetModules();
    process.env['ACTUATOR_LOG_LEVEL'] = 'SILENT';
    const { LoggersCollector: LC } = require('../src/collectors/LoggersCollector');
    const lc = new LC();
    expect(lc.getLogger('ROOT')!.effectiveLevel).toBe('OFF');
  });

  test('honors a valid ACTUATOR_LOG_LEVEL such as DEBUG', () => {
    jest.resetModules();
    process.env['ACTUATOR_LOG_LEVEL'] = 'DEBUG';
    const { LoggersCollector: LC } = require('../src/collectors/LoggersCollector');
    const lc = new LC();
    expect(lc.getLogger('ROOT')!.effectiveLevel).toBe('DEBUG');
  });

  test('falls back to WARN for an unrecognized ACTUATOR_LOG_LEVEL', () => {
    jest.resetModules();
    process.env['ACTUATOR_LOG_LEVEL'] = 'NOT_A_LEVEL';
    const { LoggersCollector: LC } = require('../src/collectors/LoggersCollector');
    const lc = new LC();
    expect(lc.getLogger('ROOT')!.effectiveLevel).toBe('WARN');
  });
});

describe('PinoLoggerAdapter', () => {
  function createMockPino(level = 'info') {
    return { level, levelVal: 30 };
  }

  test('getLevel() returns mapped level', () => {
    const adapter = new PinoLoggerAdapter(createMockPino('debug'));
    expect(adapter.getLevel('ROOT')).toBe('DEBUG');
  });

  test('setLevel() changes pino instance level', () => {
    const pino = createMockPino('info');
    const adapter = new PinoLoggerAdapter(pino);

    expect(adapter.setLevel('ROOT', 'ERROR')).toBe(true);
    expect(pino.level).toBe('error');
  });

  test('listLoggers() returns ROOT', () => {
    const adapter = new PinoLoggerAdapter(createMockPino());
    expect(adapter.listLoggers()).toEqual(['ROOT']);
  });

  test('addChild() registers named child loggers', () => {
    const pino = createMockPino();
    const child = { level: 'warn' };
    const adapter = new PinoLoggerAdapter(pino);
    adapter.addChild('http', child as any);

    expect(adapter.listLoggers()).toContain('http');
    expect(adapter.getLevel('http')).toBe('WARN');
  });

  test('collector with PinoLoggerAdapter qualifies names', () => {
    const lc = new LoggersCollector();
    const adapter = new PinoLoggerAdapter(createMockPino('info'));
    lc.addAdapter(adapter);

    const result = lc.collect();
    // With multiple adapters, names are qualified
    expect(result.loggers['pino:ROOT']).toBeDefined();
    expect(result.loggers['pino:ROOT']!.effectiveLevel).toBe('INFO');
  });

  test('getLevel() maps fatal to ERROR and silent to OFF', () => {
    expect(new PinoLoggerAdapter(createMockPino('fatal')).getLevel('ROOT')).toBe('ERROR');
    expect(new PinoLoggerAdapter(createMockPino('silent')).getLevel('ROOT')).toBe('OFF');
  });

  test('getLevel() returns null for an unrecognized pino level string', () => {
    const adapter = new PinoLoggerAdapter(createMockPino('bogus'));
    expect(adapter.getLevel('ROOT')).toBeNull();
  });

  test('getLevel() falls back to null when level is non-string (levelVal only)', () => {
    const adapter = new PinoLoggerAdapter({ levelVal: 30 });
    expect(adapter.getLevel('ROOT')).toBeNull();
  });

  test('getLevel() falls back to the root pino instance for an unknown child name', () => {
    const adapter = new PinoLoggerAdapter(createMockPino('warn'));
    expect(adapter.getLevel('unknown-child')).toBe('WARN');
  });

  test('setLevel() returns false when the target instance is missing', () => {
    const adapter = new PinoLoggerAdapter(null as any);
    expect(adapter.setLevel('ROOT', 'DEBUG')).toBe(false);
  });

  test('setLevel() returns false for an invalid level', () => {
    const adapter = new PinoLoggerAdapter(createMockPino());
    expect(adapter.setLevel('ROOT', 'BOGUS' as any)).toBe(false);
  });

  test('setLevel() maps OFF to pino "silent"', () => {
    const pino = createMockPino('info');
    const adapter = new PinoLoggerAdapter(pino);
    expect(adapter.setLevel('ROOT', 'OFF')).toBe(true);
    expect(pino.level).toBe('silent');
  });
});

describe('WinstonLoggerAdapter', () => {
  function createMockWinston(level = 'info'): { level: string; silent?: boolean } {
    return { level };
  }

  test('getLevel() maps winston levels', () => {
    const adapter = new WinstonLoggerAdapter(createMockWinston('debug'));
    expect(adapter.getLevel('ROOT')).toBe('DEBUG');
  });

  test('setLevel() changes winston level', () => {
    const w = createMockWinston('info');
    const adapter = new WinstonLoggerAdapter(w);
    expect(adapter.setLevel('ROOT', 'WARN')).toBe(true);
    expect(w.level).toBe('warn');
  });

  test('handles silly level as TRACE', () => {
    const adapter = new WinstonLoggerAdapter(createMockWinston('silly'));
    expect(adapter.getLevel('ROOT')).toBe('TRACE');
  });

  test('handles verbose as TRACE and warning as WARN', () => {
    expect(new WinstonLoggerAdapter(createMockWinston('verbose')).getLevel('ROOT')).toBe('TRACE');
    expect(new WinstonLoggerAdapter(createMockWinston('warning')).getLevel('ROOT')).toBe('WARN');
  });

  test('handles crit/alert/emerg as ERROR', () => {
    expect(new WinstonLoggerAdapter(createMockWinston('crit')).getLevel('ROOT')).toBe('ERROR');
    expect(new WinstonLoggerAdapter(createMockWinston('alert')).getLevel('ROOT')).toBe('ERROR');
    expect(new WinstonLoggerAdapter(createMockWinston('emerg')).getLevel('ROOT')).toBe('ERROR');
  });

  test('getLevel() returns null for an unrecognized or missing winston level', () => {
    expect(new WinstonLoggerAdapter(createMockWinston('bogus')).getLevel('ROOT')).toBeNull();
    expect(new WinstonLoggerAdapter({}).getLevel('ROOT')).toBeNull();
  });

  test('setLevel() maps OFF to winston silent=true', () => {
    const w = createMockWinston('info');
    const adapter = new WinstonLoggerAdapter(w);
    expect(adapter.setLevel('ROOT', 'OFF')).toBe(true);
    expect(w.silent).toBe(true);
  });

  test('setLevel() clears silent when setting a non-OFF level', () => {
    const w = createMockWinston('info');
    (w as any).silent = true;
    const adapter = new WinstonLoggerAdapter(w);
    expect(adapter.setLevel('ROOT', 'WARN')).toBe(true);
    expect(w.level).toBe('warn');
    expect(w.silent).toBe(false);
  });

  test('setLevel() returns false when the target instance is missing', () => {
    const adapter = new WinstonLoggerAdapter(null as any);
    expect(adapter.setLevel('ROOT', 'DEBUG')).toBe(false);
  });

  test('setLevel() returns false for an invalid level', () => {
    const adapter = new WinstonLoggerAdapter(createMockWinston());
    expect(adapter.setLevel('ROOT', 'BOGUS' as any)).toBe(false);
  });

  test('addChild() registers named child loggers', () => {
    const w = createMockWinston('info');
    const child = createMockWinston('debug');
    const adapter = new WinstonLoggerAdapter(w);
    adapter.addChild('worker', child);

    expect(adapter.listLoggers()).toContain('worker');
    expect(adapter.getLevel('worker')).toBe('DEBUG');
  });
});

describe('BunyanLoggerAdapter', () => {
  function createMockBunyan(numericLevel = 30) {
    return {
      level: jest.fn((newLevel?: string) => {
        if (newLevel !== undefined) {
          // setter
          return;
        }
        return numericLevel;
      }),
    };
  }

  test('getLevel() maps bunyan numeric levels', () => {
    const adapter = new BunyanLoggerAdapter(createMockBunyan(20));
    expect(adapter.getLevel('ROOT')).toBe('DEBUG');
  });

  test('getLevel() maps INFO level (30)', () => {
    const adapter = new BunyanLoggerAdapter(createMockBunyan(30));
    expect(adapter.getLevel('ROOT')).toBe('INFO');
  });

  test('setLevel() calls bunyan level()', () => {
    const bunyan = createMockBunyan(30);
    const adapter = new BunyanLoggerAdapter(bunyan);
    expect(adapter.setLevel('ROOT', 'ERROR')).toBe(true);
    expect(bunyan.level).toHaveBeenCalledWith('error');
  });

  test('maps numeric level boundaries to the right LoggerLevel', () => {
    expect(new BunyanLoggerAdapter(createMockBunyan(10)).getLevel('ROOT')).toBe('TRACE');
    expect(new BunyanLoggerAdapter(createMockBunyan(40)).getLevel('ROOT')).toBe('WARN');
    expect(new BunyanLoggerAdapter(createMockBunyan(50)).getLevel('ROOT')).toBe('ERROR');
    expect(new BunyanLoggerAdapter(createMockBunyan(60)).getLevel('ROOT')).toBe('OFF');
  });

  test('getLevel() returns null when the underlying level is undefined', () => {
    const adapter = new BunyanLoggerAdapter({ level: jest.fn(() => undefined) });
    expect(adapter.getLevel('ROOT')).toBeNull();
  });

  test('setLevel() maps OFF to numeric level above FATAL (silences completely)', () => {
    const bunyan = createMockBunyan(30);
    const adapter = new BunyanLoggerAdapter(bunyan);
    expect(adapter.setLevel('ROOT', 'OFF')).toBe(true);
    expect(bunyan.level).toHaveBeenCalledWith(Number.MAX_SAFE_INTEGER);
  });

  test('setLevel() returns false when the target instance is missing', () => {
    const adapter = new BunyanLoggerAdapter(null as any);
    expect(adapter.setLevel('ROOT', 'DEBUG')).toBe(false);
  });

  test('setLevel() returns false for an invalid level', () => {
    const adapter = new BunyanLoggerAdapter(createMockBunyan());
    expect(adapter.setLevel('ROOT', 'BOGUS' as any)).toBe(false);
  });

  test('addChild() registers named child loggers', () => {
    const bunyan = createMockBunyan(30);
    const child = createMockBunyan(20);
    const adapter = new BunyanLoggerAdapter(bunyan);
    adapter.addChild('worker', child);

    expect(adapter.listLoggers()).toContain('worker');
    expect(adapter.getLevel('worker')).toBe('DEBUG');
  });
});

describe('LoggersCollector with multiple adapters', () => {
  test('removeAdapter() removes by name', () => {
    const lc = new LoggersCollector();
    const adapter = new PinoLoggerAdapter({ level: 'info' });
    lc.addAdapter(adapter);
    expect(lc.removeAdapter('pino')).toBe(true);
    expect(lc.removeAdapter('pino')).toBe(false); // already gone
  });

  test('cannot remove builtin adapter', () => {
    const lc = new LoggersCollector();
    expect(lc.removeAdapter('builtin')).toBe(false);
  });

  test('setLevel with qualified name targets correct adapter', () => {
    const lc = new LoggersCollector();
    const pino = { level: 'info' };
    const adapter = new PinoLoggerAdapter(pino);
    lc.addAdapter(adapter);

    expect(lc.setLevel('pino:ROOT', 'DEBUG')).toBe(true);
    expect(pino.level).toBe('debug');
  });
});

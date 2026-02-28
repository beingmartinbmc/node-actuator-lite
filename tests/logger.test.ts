import { logger, LOG_LEVELS } from '../src/utils/logger';

describe('Logger', () => {
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    // Reset to suppress logs in other tests
    logger.setLevel('SILENT');
  });

  // ===========================================================================
  // LOG_LEVELS
  // ===========================================================================

  test('LOG_LEVELS has correct numeric values', () => {
    expect(LOG_LEVELS.TRACE).toBe(10);
    expect(LOG_LEVELS.DEBUG).toBe(20);
    expect(LOG_LEVELS.INFO).toBe(30);
    expect(LOG_LEVELS.WARN).toBe(40);
    expect(LOG_LEVELS.ERROR).toBe(50);
    expect(LOG_LEVELS.SILENT).toBe(60);
  });

  // ===========================================================================
  // setLevel + filtering
  // ===========================================================================

  test('setLevel(TRACE) logs all levels', () => {
    logger.setLevel('TRACE');
    logger.trace('t');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    // stdout: trace, debug, info, warn (4 calls)
    // stderr: error (1 call)
    expect(stdoutSpy).toHaveBeenCalledTimes(4);
    expect(stderrSpy).toHaveBeenCalledTimes(1);
  });

  test('setLevel(WARN) suppresses trace/debug/info', () => {
    logger.setLevel('WARN');
    logger.trace('t');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(stdoutSpy).toHaveBeenCalledTimes(1); // warn
    expect(stderrSpy).toHaveBeenCalledTimes(1); // error
  });

  test('setLevel(ERROR) suppresses everything below error', () => {
    logger.setLevel('ERROR');
    logger.trace('t');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(stdoutSpy).toHaveBeenCalledTimes(0);
    expect(stderrSpy).toHaveBeenCalledTimes(1);
  });

  test('setLevel(SILENT) suppresses all output', () => {
    logger.setLevel('SILENT');
    logger.trace('t');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(stdoutSpy).toHaveBeenCalledTimes(0);
    expect(stderrSpy).toHaveBeenCalledTimes(0);
  });

  // ===========================================================================
  // Output format
  // ===========================================================================

  test('output is valid JSON', () => {
    logger.setLevel('INFO');
    logger.info('test message');
    const line = stdoutSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(line.trim());
    expect(parsed.level).toBe('INFO');
    expect(parsed.msg).toBe('test message');
    expect(parsed.time).toBeDefined();
  });

  test('data field is included when provided', () => {
    logger.setLevel('INFO');
    logger.info('with data', { key: 'value' });
    const line = stdoutSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(line.trim());
    expect(parsed.data).toEqual({ key: 'value' });
  });

  test('data field is omitted when not provided', () => {
    logger.setLevel('INFO');
    logger.info('no data');
    const line = stdoutSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(line.trim());
    expect(parsed.data).toBeUndefined();
  });

  test('error level writes to stderr', () => {
    logger.setLevel('ERROR');
    logger.error('bad thing', { code: 500 });
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const line = stderrSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(line.trim());
    expect(parsed.level).toBe('ERROR');
    expect(parsed.msg).toBe('bad thing');
    expect(parsed.data).toEqual({ code: 500 });
  });

  test('warn level writes to stdout', () => {
    logger.setLevel('WARN');
    logger.warn('warning');
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(stderrSpy).toHaveBeenCalledTimes(0);
  });

  // ===========================================================================
  // Each log method
  // ===========================================================================

  test.each([
    ['trace', 'TRACE'],
    ['debug', 'DEBUG'],
    ['info', 'INFO'],
    ['warn', 'WARN'],
    ['error', 'ERROR'],
  ] as const)('%s() logs with level %s', (method, expectedLevel) => {
    logger.setLevel('TRACE');
    (logger as any)[method]('msg');
    const spy = LOG_LEVELS[expectedLevel] >= LOG_LEVELS.ERROR ? stderrSpy : stdoutSpy;
    expect(spy).toHaveBeenCalled();
    const line = spy.mock.calls[spy.mock.calls.length - 1]![0] as string;
    const parsed = JSON.parse(line.trim());
    expect(parsed.level).toBe(expectedLevel);
  });
});

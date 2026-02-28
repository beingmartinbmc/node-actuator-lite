import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import v8 from 'v8';
import { HeapDumpCollector } from '../src/collectors/HeapDumpCollector';
import type { ResolvedActuatorOptions } from '../src/core/types';

const TEST_OUTPUT_DIR = join(__dirname, '..', '.test-heapdumps');

// Mock v8.writeHeapSnapshot so tests don't generate real multi-MB snapshots
jest.spyOn(v8, 'writeHeapSnapshot').mockImplementation((filePath?: string) => {
  if (filePath) {
    require('fs').writeFileSync(filePath, '{"mock":"heapdump"}');
  }
  return filePath ?? 'mock.heapsnapshot';
});

function makeConfig(
  overrides: Partial<ResolvedActuatorOptions['heapDump']> = {},
): ResolvedActuatorOptions['heapDump'] {
  return {
    enabled: true,
    outputDir: TEST_OUTPUT_DIR,
    ...overrides,
  };
}

beforeEach(() => {
  if (existsSync(TEST_OUTPUT_DIR)) {
    rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
  }
});

afterAll(() => {
  if (existsSync(TEST_OUTPUT_DIR)) {
    rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
  }
  jest.restoreAllMocks();
});

describe('HeapDumpCollector', () => {
  test('collect() creates output directory if missing', async () => {
    const hdc = new HeapDumpCollector(makeConfig());
    await hdc.collect();
    expect(existsSync(TEST_OUTPUT_DIR)).toBe(true);
  });

  test('collect() returns expected response shape', async () => {
    const hdc = new HeapDumpCollector(makeConfig());
    const result = await hdc.collect();

    expect(result.timestamp).toBeDefined();
    expect(typeof result.timestamp).toBe('string');
    expect(result.pid).toBe(process.pid);
    expect(typeof result.filePath).toBe('string');
    expect(result.filePath).toContain('.heapsnapshot');
    expect(typeof result.fileSize).toBe('number');
    expect(result.fileSize).toBeGreaterThan(0);
    expect(typeof result.duration).toBe('number');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test('collect() creates a file on disk', async () => {
    const hdc = new HeapDumpCollector(makeConfig());
    const result = await hdc.collect();
    expect(existsSync(result.filePath)).toBe(true);
  });

  test('collect() includes memoryBefore and memoryAfter', async () => {
    const hdc = new HeapDumpCollector(makeConfig());
    const result = await hdc.collect();

    expect(result.memoryBefore).toBeDefined();
    expect(typeof result.memoryBefore.heapUsed).toBe('number');
    expect(result.memoryAfter).toBeDefined();
    expect(typeof result.memoryAfter.heapUsed).toBe('number');
  });

  test('multiple collects create separate files', async () => {
    const hdc = new HeapDumpCollector(makeConfig());
    const r1 = await hdc.collect();
    const r2 = await hdc.collect();
    expect(r1.filePath).not.toBe(r2.filePath);
    expect(existsSync(r1.filePath)).toBe(true);
    expect(existsSync(r2.filePath)).toBe(true);
  });

  test('collect() filePath is inside outputDir', async () => {
    const hdc = new HeapDumpCollector(makeConfig());
    const result = await hdc.collect();
    expect(result.filePath.startsWith(TEST_OUTPUT_DIR)).toBe(true);
  });

  test('collect() works with nested outputDir', async () => {
    const nested = join(TEST_OUTPUT_DIR, 'sub', 'dir');
    const hdc = new HeapDumpCollector(makeConfig({ outputDir: nested }));
    const result = await hdc.collect();
    expect(existsSync(nested)).toBe(true);
    expect(existsSync(result.filePath)).toBe(true);
  });

  test('fallback is used when v8.writeHeapSnapshot throws', async () => {
    (v8.writeHeapSnapshot as jest.Mock).mockImplementationOnce(() => {
      throw new Error('not supported');
    });
    const hdc = new HeapDumpCollector(makeConfig());
    const result = await hdc.collect();
    // Fallback writes a JSON file instead
    expect(existsSync(result.filePath)).toBe(true);
    const content = require('fs').readFileSync(result.filePath, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed.note).toContain('Fallback');
  });
});

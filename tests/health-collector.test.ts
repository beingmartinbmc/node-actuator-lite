import { HealthCollector } from '../src/collectors/HealthCollector';
import type { ResolvedActuatorOptions } from '../src/core/types';

function makeConfig(
  overrides: Partial<ResolvedActuatorOptions['health']> = {},
): ResolvedActuatorOptions['health'] {
  return {
    enabled: true,
    showDetails: 'always',
    timeout: 5000,
    indicators: {
      diskSpace: { enabled: true, threshold: 10 * 1024 * 1024, path: '/' },
      process: { enabled: true },
    },
    groups: {},
    custom: [],
    ...overrides,
  };
}

// =============================================================================
// Basic API
// =============================================================================

describe('HealthCollector', () => {
  test('shallow() returns only status, no components', async () => {
    const hc = new HealthCollector(makeConfig());
    const result = await hc.shallow();
    expect(result.status).toBeDefined();
    expect(result.components).toBeUndefined();
  });

  test('deep() returns status and components', async () => {
    const hc = new HealthCollector(makeConfig());
    const result = await hc.deep();
    expect(result.status).toBeDefined();
    expect(result.components).toBeDefined();
    expect(result.components!['diskSpace']).toBeDefined();
    expect(result.components!['process']).toBeDefined();
  });

  test('collect() defaults to configured showDetails', async () => {
    const hcAlways = new HealthCollector(makeConfig({ showDetails: 'always' }));
    const r1 = await hcAlways.collect();
    expect(r1.components).toBeDefined();

    const hcNever = new HealthCollector(makeConfig({ showDetails: 'never' }));
    const r2 = await hcNever.collect();
    expect(r2.components).toBeUndefined();
  });

  test('collect() showDetails param overrides config', async () => {
    const hc = new HealthCollector(makeConfig({ showDetails: 'never' }));
    const deep = await hc.collect('always');
    expect(deep.components).toBeDefined();

    const hc2 = new HealthCollector(makeConfig({ showDetails: 'always' }));
    const shallow = await hc2.collect('never');
    expect(shallow.components).toBeUndefined();
  });

  // ===========================================================================
  // Indicators
  // ===========================================================================

  test('indicatorNames() lists built-in and custom', () => {
    const hc = new HealthCollector(
      makeConfig({
        custom: [
          { name: 'db', check: async () => ({ status: 'UP' }), critical: false },
        ],
      }),
    );
    expect(hc.indicatorNames()).toEqual(['diskSpace', 'process', 'db']);
  });

  test('disabled indicators are not registered', () => {
    const hc = new HealthCollector(
      makeConfig({
        indicators: {
          diskSpace: { enabled: false, threshold: 0, path: '/' },
          process: { enabled: false },
        },
      }),
    );
    expect(hc.indicatorNames()).toEqual([]);
  });

  test('component() returns null for unknown name', async () => {
    const hc = new HealthCollector(makeConfig());
    expect(await hc.component('nonexistent')).toBeNull();
  });

  test('component() returns result for known indicator', async () => {
    const hc = new HealthCollector(makeConfig());
    const c = await hc.component('process');
    expect(c).not.toBeNull();
    expect(c!.status).toBe('UP');
    expect(c!.details).toBeDefined();
    expect(c!.details!['pid']).toBe(process.pid);
  });

  test('diskSpace indicator returns UP with valid data', async () => {
    const hc = new HealthCollector(makeConfig());
    const c = await hc.component('diskSpace');
    expect(c).not.toBeNull();
    // On any OS with > 10MB free this should be UP
    expect(['UP', 'UNKNOWN']).toContain(c!.status);
    if (c!.status === 'UP') {
      expect(c!.details!['total']).toBeGreaterThan(0);
      expect(c!.details!['free']).toBeGreaterThan(0);
    }
  });

  test('diskSpace indicator returns DOWN when threshold is impossibly high', async () => {
    const hc = new HealthCollector(
      makeConfig({
        indicators: {
          diskSpace: { enabled: true, threshold: Number.MAX_SAFE_INTEGER, path: '/' },
          process: { enabled: false },
        },
      }),
    );
    const c = await hc.component('diskSpace');
    expect(c).not.toBeNull();
    // Either DOWN (threshold exceeded) or UNKNOWN (couldn't read disk)
    expect(['DOWN', 'UNKNOWN']).toContain(c!.status);
  });

  // ===========================================================================
  // addIndicator / removeIndicator
  // ===========================================================================

  test('addIndicator() registers a new indicator', async () => {
    const hc = new HealthCollector(makeConfig());
    hc.addIndicator({
      name: 'custom1',
      check: async () => ({ status: 'UP', details: { hello: 'world' } }),
    });
    expect(hc.indicatorNames()).toContain('custom1');

    const c = await hc.component('custom1');
    expect(c!.status).toBe('UP');
    expect(c!.details!['hello']).toBe('world');
  });

  test('addIndicator() with critical flag', async () => {
    const hc = new HealthCollector(
      makeConfig({
        indicators: { diskSpace: { enabled: false, threshold: 0, path: '/' }, process: { enabled: false } },
      }),
    );
    hc.addIndicator({
      name: 'criticalService',
      check: async () => ({ status: 'DOWN', details: { reason: 'offline' } }),
      critical: true,
    });
    const result = await hc.deep();
    expect(result.status).toBe('DOWN');
  });

  test('removeIndicator() returns true and removes', () => {
    const hc = new HealthCollector(makeConfig());
    expect(hc.removeIndicator('process')).toBe(true);
    expect(hc.indicatorNames()).not.toContain('process');
  });

  test('removeIndicator() returns false for nonexistent', () => {
    const hc = new HealthCollector(makeConfig());
    expect(hc.removeIndicator('nope')).toBe(false);
  });

  // ===========================================================================
  // Health Groups
  // ===========================================================================

  test('group() returns null for unknown group', async () => {
    const hc = new HealthCollector(makeConfig());
    expect(await hc.group('nonexistent')).toBeNull();
  });

  test('group() aggregates members', async () => {
    const hc = new HealthCollector(
      makeConfig({
        groups: { liveness: ['process'] },
      }),
    );
    const g = await hc.group('liveness');
    expect(g).not.toBeNull();
    expect(g!.status).toBe('UP');
    expect(g!.components!['process']).toBeDefined();
  });

  test('group() skips unknown members gracefully', async () => {
    const hc = new HealthCollector(
      makeConfig({
        groups: { test: ['process', 'nonexistent'] },
      }),
    );
    const g = await hc.group('test');
    expect(g!.components!['process']).toBeDefined();
    expect(g!.components!['nonexistent']).toBeUndefined();
  });

  // ===========================================================================
  // Aggregation Logic
  // ===========================================================================

  test('aggregation: all UP → overall UP', async () => {
    const hc = new HealthCollector(
      makeConfig({
        indicators: { diskSpace: { enabled: false, threshold: 0, path: '/' }, process: { enabled: false } },
        custom: [
          { name: 'a', check: async () => ({ status: 'UP' }) },
          { name: 'b', check: async () => ({ status: 'UP' }) },
        ],
      }),
    );
    const r = await hc.deep();
    expect(r.status).toBe('UP');
  });

  test('aggregation: one DOWN non-critical → overall DOWN', async () => {
    const hc = new HealthCollector(
      makeConfig({
        indicators: { diskSpace: { enabled: false, threshold: 0, path: '/' }, process: { enabled: false } },
        custom: [
          { name: 'a', check: async () => ({ status: 'UP' }) },
          { name: 'b', check: async () => ({ status: 'DOWN' }), critical: false },
        ],
      }),
    );
    const r = await hc.deep();
    expect(r.status).toBe('DOWN');
  });

  test('aggregation: critical DOWN → overall DOWN immediately', async () => {
    const hc = new HealthCollector(
      makeConfig({
        indicators: { diskSpace: { enabled: false, threshold: 0, path: '/' }, process: { enabled: false } },
        custom: [
          { name: 'a', check: async () => ({ status: 'UP' }) },
          { name: 'crit', check: async () => ({ status: 'DOWN' }), critical: true },
        ],
      }),
    );
    const r = await hc.deep();
    expect(r.status).toBe('DOWN');
  });

  test('aggregation: OUT_OF_SERVICE beats UP', async () => {
    const hc = new HealthCollector(
      makeConfig({
        indicators: { diskSpace: { enabled: false, threshold: 0, path: '/' }, process: { enabled: false } },
        custom: [
          { name: 'a', check: async () => ({ status: 'UP' }) },
          { name: 'b', check: async () => ({ status: 'OUT_OF_SERVICE' }) },
        ],
      }),
    );
    const r = await hc.deep();
    expect(r.status).toBe('OUT_OF_SERVICE');
  });

  test('aggregation: UNKNOWN beats UP but not DOWN', async () => {
    const hc = new HealthCollector(
      makeConfig({
        indicators: { diskSpace: { enabled: false, threshold: 0, path: '/' }, process: { enabled: false } },
        custom: [
          { name: 'a', check: async () => ({ status: 'UP' }) },
          { name: 'b', check: async () => ({ status: 'UNKNOWN' }) },
        ],
      }),
    );
    const r = await hc.deep();
    expect(r.status).toBe('UNKNOWN');
  });

  test('aggregation: no indicators → UNKNOWN', async () => {
    const hc = new HealthCollector(
      makeConfig({
        indicators: { diskSpace: { enabled: false, threshold: 0, path: '/' }, process: { enabled: false } },
      }),
    );
    const r = await hc.deep();
    expect(r.status).toBe('UNKNOWN');
  });

  // ===========================================================================
  // Timeout
  // ===========================================================================

  test('timed-out indicator returns DOWN with error', async () => {
    const hc = new HealthCollector(
      makeConfig({
        timeout: 50, // 50ms
        indicators: { diskSpace: { enabled: false, threshold: 0, path: '/' }, process: { enabled: false } },
        custom: [
          {
            name: 'slow',
            check: () => new Promise((resolve) => setTimeout(() => resolve({ status: 'UP' as const }), 500)),
          },
        ],
      }),
    );
    const c = await hc.component('slow');
    expect(c!.status).toBe('DOWN');
    expect(c!.details!['error']).toContain('timed out');
  });

  test('throwing indicator returns DOWN with error message', async () => {
    const hc = new HealthCollector(
      makeConfig({
        indicators: { diskSpace: { enabled: false, threshold: 0, path: '/' }, process: { enabled: false } },
        custom: [
          {
            name: 'broken',
            check: async () => { throw new Error('connection refused'); },
          },
        ],
      }),
    );
    const c = await hc.component('broken');
    expect(c!.status).toBe('DOWN');
    expect(c!.details!['error']).toBe('connection refused');
  });

  // ===========================================================================
  // Indicator returning no details
  // ===========================================================================

  test('indicator without details omits details from response', async () => {
    const hc = new HealthCollector(
      makeConfig({
        indicators: { diskSpace: { enabled: false, threshold: 0, path: '/' }, process: { enabled: false } },
        custom: [
          { name: 'simple', check: async () => ({ status: 'UP' }) },
        ],
      }),
    );
    const c = await hc.component('simple');
    expect(c!.status).toBe('UP');
    expect(c!.details).toBeUndefined();
  });
});

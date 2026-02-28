import { PrometheusCollector } from '../src/collectors/PrometheusCollector';
import type { ResolvedActuatorOptions } from '../src/core/types';
import { Counter, Gauge, Histogram, Summary } from 'prom-client';

function makeConfig(
  overrides: Partial<ResolvedActuatorOptions['prometheus']> = {},
): ResolvedActuatorOptions['prometheus'] {
  return {
    enabled: true,
    defaultMetrics: false,
    prefix: '',
    customMetrics: [],
    ...overrides,
  };
}

describe('PrometheusCollector', () => {
  // ===========================================================================
  // Basic collect
  // ===========================================================================

  test('collect() returns a string', async () => {
    const pc = new PrometheusCollector(makeConfig());
    const text = await pc.collect();
    expect(typeof text).toBe('string');
  });

  test('collect() with defaultMetrics includes nodejs metrics', async () => {
    const pc = new PrometheusCollector(makeConfig({ defaultMetrics: true }));
    // Give prom-client a tick to register default metrics
    await new Promise((r) => setTimeout(r, 50));
    const text = await pc.collect();
    expect(text).toContain('nodejs');
  });

  test('collectJSON() returns an array', async () => {
    const pc = new PrometheusCollector(makeConfig());
    const json = await pc.collectJSON();
    expect(Array.isArray(json)).toBe(true);
  });

  // ===========================================================================
  // Custom metric registration via config
  // ===========================================================================

  test('counter registered via config is accessible', async () => {
    const pc = new PrometheusCollector(
      makeConfig({
        customMetrics: [{ name: 'cfg_counter', help: 'A counter', type: 'counter' }],
      }),
    );
    const m = pc.metric('cfg_counter');
    expect(m).toBeDefined();
    expect(m).toBeInstanceOf(Counter);
  });

  test('gauge registered via config is accessible', () => {
    const pc = new PrometheusCollector(
      makeConfig({
        customMetrics: [{ name: 'cfg_gauge', help: 'A gauge', type: 'gauge' }],
      }),
    );
    expect(pc.metric('cfg_gauge')).toBeInstanceOf(Gauge);
  });

  test('histogram registered via config with buckets', async () => {
    const pc = new PrometheusCollector(
      makeConfig({
        customMetrics: [
          { name: 'cfg_hist', help: 'A histogram', type: 'histogram', buckets: [0.01, 0.1, 1] },
        ],
      }),
    );
    const m = pc.metric('cfg_hist');
    expect(m).toBeInstanceOf(Histogram);
    (m as Histogram).observe(0.05);
    const text = await pc.collect();
    expect(text).toContain('cfg_hist');
  });

  test('summary registered via config', () => {
    const pc = new PrometheusCollector(
      makeConfig({
        customMetrics: [{ name: 'cfg_summary', help: 'A summary', type: 'summary' }],
      }),
    );
    expect(pc.metric('cfg_summary')).toBeInstanceOf(Summary);
  });

  test('metric with labels works correctly', async () => {
    const pc = new PrometheusCollector(
      makeConfig({
        customMetrics: [
          { name: 'labeled_counter', help: 'Labeled', type: 'counter', labels: ['method', 'status'] },
        ],
      }),
    );
    const c = pc.metric<Counter>('labeled_counter')!;
    c.inc({ method: 'GET', status: '200' });
    c.inc({ method: 'POST', status: '201' });
    const text = await pc.collect();
    expect(text).toContain('method="GET"');
    expect(text).toContain('method="POST"');
  });

  // ===========================================================================
  // Runtime registration
  // ===========================================================================

  test('registerMetric() adds a new metric at runtime', async () => {
    const pc = new PrometheusCollector(makeConfig());
    const m = pc.registerMetric({ name: 'rt_gauge', help: 'Runtime gauge', type: 'gauge' });
    expect(m).toBeInstanceOf(Gauge);
    expect(pc.metric('rt_gauge')).toBe(m);

    (m as Gauge).set(42);
    const text = await pc.collect();
    expect(text).toContain('rt_gauge 42');
  });

  test('registerMetric() returns existing if already registered', () => {
    const pc = new PrometheusCollector(
      makeConfig({
        customMetrics: [{ name: 'dup', help: 'Dup', type: 'counter' }],
      }),
    );
    const first = pc.metric('dup');
    const second = pc.registerMetric({ name: 'dup', help: 'Dup', type: 'counter' });
    expect(second).toBe(first);
  });

  test('registerMetric() throws for unknown type', () => {
    const pc = new PrometheusCollector(makeConfig());
    expect(() => {
      pc.registerMetric({ name: 'bad', help: 'Bad', type: 'unknown' as any });
    }).toThrow('Unknown metric type');
  });

  // ===========================================================================
  // removeMetric
  // ===========================================================================

  test('removeMetric() removes and returns true', async () => {
    const pc = new PrometheusCollector(
      makeConfig({
        customMetrics: [{ name: 'to_remove', help: 'Remove me', type: 'counter' }],
      }),
    );
    expect(pc.removeMetric('to_remove')).toBe(true);
    expect(pc.metric('to_remove')).toBeUndefined();
    const text = await pc.collect();
    expect(text).not.toContain('to_remove');
  });

  test('removeMetric() returns false for nonexistent', () => {
    const pc = new PrometheusCollector(makeConfig());
    expect(pc.removeMetric('nope')).toBe(false);
  });

  // ===========================================================================
  // getRegistry / reset
  // ===========================================================================

  test('getRegistry() returns the prom-client Registry', () => {
    const pc = new PrometheusCollector(makeConfig());
    const reg = pc.getRegistry();
    expect(reg).toBeDefined();
    expect(typeof reg.metrics).toBe('function');
  });

  test('reset() clears metric values', async () => {
    const pc = new PrometheusCollector(
      makeConfig({
        customMetrics: [{ name: 'resettable', help: 'Reset me', type: 'counter' }],
      }),
    );
    const c = pc.metric<Counter>('resettable')!;
    c.inc(10);
    let text = await pc.collect();
    expect(text).toContain('resettable 10');

    await pc.reset();
    text = await pc.collect();
    expect(text).toContain('resettable 0');
  });

  // ===========================================================================
  // Prefix
  // ===========================================================================

  test('prefix sets default labels', async () => {
    const pc = new PrometheusCollector(
      makeConfig({
        prefix: 'myapp',
        customMetrics: [{ name: 'prefixed_counter', help: 'Prefixed', type: 'counter' }],
      }),
    );
    const c = pc.metric<Counter>('prefixed_counter')!;
    c.inc();
    const text = await pc.collect();
    expect(text).toContain('prefix="myapp"');
  });

  // ===========================================================================
  // metric() for unknown
  // ===========================================================================

  test('metric() returns undefined for unknown name', () => {
    const pc = new PrometheusCollector(makeConfig());
    expect(pc.metric('nonexistent')).toBeUndefined();
  });
});

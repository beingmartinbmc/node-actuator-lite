import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Summary,
} from 'prom-client';
import { logger } from '../utils/logger';
import type { ResolvedActuatorOptions, CustomMetricDefinition } from '../core/types';

type AnyMetric = Counter | Gauge | Histogram | Summary;

export class PrometheusCollector {
  private registry: Registry;
  private customMetrics: Map<string, AnyMetric> = new Map();

  constructor(config: ResolvedActuatorOptions['prometheus']) {
    this.registry = new Registry();

    if (config.prefix) {
      this.registry.setDefaultLabels({ prefix: config.prefix });
    }

    if (config.defaultMetrics) {
      collectDefaultMetrics({ register: this.registry });
    }

    for (const def of config.customMetrics) {
      this.registerMetric(def);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Return all metrics in Prometheus text exposition format. */
  async collect(): Promise<string> {
    return this.registry.metrics();
  }

  /** Return metrics as JSON. */
  async collectJSON(): Promise<any[]> {
    return this.registry.getMetricsAsJSON();
  }

  /** Get a previously registered custom metric by name. */
  metric<T extends AnyMetric = AnyMetric>(name: string): T | undefined {
    return this.customMetrics.get(name) as T | undefined;
  }

  /** Register a new custom metric at runtime. */
  registerMetric(def: CustomMetricDefinition): AnyMetric {
    const existing = this.customMetrics.get(def.name);
    if (existing) return existing;

    const opts: any = {
      name: def.name,
      help: def.help,
      labelNames: def.labels ?? [],
      registers: [this.registry],
    };

    let metric: AnyMetric;
    switch (def.type) {
      case 'counter':
        metric = new Counter(opts);
        break;
      case 'gauge':
        metric = new Gauge(opts);
        break;
      case 'histogram':
        if (def.buckets) opts.buckets = def.buckets;
        metric = new Histogram(opts);
        break;
      case 'summary':
        metric = new Summary(opts);
        break;
      default:
        throw new Error(`Unknown metric type: ${def.type}`);
    }

    this.customMetrics.set(def.name, metric);
    logger.debug(`Registered custom metric: ${def.name} (${def.type})`);
    return metric;
  }

  /** Remove a custom metric by name. */
  removeMetric(name: string): boolean {
    const m = this.customMetrics.get(name);
    if (!m) return false;
    this.registry.removeSingleMetric(name);
    this.customMetrics.delete(name);
    return true;
  }

  /** Get the underlying prom-client Registry for advanced usage. */
  getRegistry(): Registry {
    return this.registry;
  }

  /** Reset all metrics (useful in tests). */
  async reset(): Promise<void> {
    this.registry.resetMetrics();
  }
}

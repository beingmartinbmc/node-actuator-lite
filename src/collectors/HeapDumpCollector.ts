import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import v8 from 'v8';
import { logger } from '../utils/logger';
import type { HeapDumpResponse, ResolvedActuatorOptions } from '../core/types';

export class HeapDumpCollector {
  private outputDir: string;

  constructor(config: ResolvedActuatorOptions['heapDump']) {
    this.outputDir = config.outputDir;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async collect(): Promise<HeapDumpResponse> {
    const start = Date.now();
    const memoryBefore = process.memoryUsage();

    this.ensureOutputDir();

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const id = randomUUID().slice(0, 8);
    const filename = `heapdump-${ts}-${id}.heapsnapshot`;
    const filePath = join(this.outputDir, filename);

    this.writeSnapshot(filePath);

    const memoryAfter = process.memoryUsage();
    const stats = statSync(filePath);

    return {
      timestamp: new Date().toISOString(),
      pid: process.pid,
      filePath,
      fileSize: stats.size,
      duration: Date.now() - start,
      memoryBefore,
      memoryAfter,
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private writeSnapshot(filePath: string): void {
    try {
      // v8.writeHeapSnapshot writes synchronously and returns the filename
      v8.writeHeapSnapshot(filePath);
      logger.info('Heap snapshot written via v8.writeHeapSnapshot', { filePath });
    } catch (err: any) {
      logger.warn('v8.writeHeapSnapshot failed, generating manual dump', { error: err.message });
      this.writeFallbackDump(filePath);
    }
  }

  private writeFallbackDump(filePath: string): void {
    const dump = {
      timestamp: new Date().toISOString(),
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
      v8HeapStats: v8.getHeapStatistics(),
      v8HeapSpaces: v8.getHeapSpaceStatistics(),
      note: 'Fallback dump — v8.writeHeapSnapshot was not available. Use --inspect and Chrome DevTools for full heap analysis.',
    };
    writeFileSync(filePath, JSON.stringify(dump, null, 2));
  }

  private ensureOutputDir(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }
}

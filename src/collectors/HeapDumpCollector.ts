import { existsSync, mkdirSync, statSync, writeFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import v8 from 'v8';
import { logger } from '../utils/logger';
import type { HeapDumpResponse, ResolvedActuatorOptions } from '../core/types';

/** Thrown when a heap dump is rejected due to throttling or concurrency limits. */
export class HeapDumpThrottledError extends Error {
  readonly retryAfterMs: number | undefined;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'HeapDumpThrottledError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class HeapDumpCollector {
  private outputDir: string;
  private minIntervalMs: number;
  private lastDumpAt = 0;
  private inProgress = false;

  constructor(config: ResolvedActuatorOptions['heapDump']) {
    this.outputDir = config.outputDir;
    this.minIntervalMs = config.minIntervalMs;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async collect(): Promise<HeapDumpResponse> {
    if (this.inProgress) {
      throw new HeapDumpThrottledError('A heap dump is already in progress');
    }
    const now = Date.now();
    if (this.minIntervalMs > 0 && now - this.lastDumpAt < this.minIntervalMs) {
      const retryInMs = this.minIntervalMs - (now - this.lastDumpAt);
      throw new HeapDumpThrottledError(
        `Heap dumps are throttled; retry in ${retryInMs}ms`,
        retryInMs,
      );
    }

    this.inProgress = true;
    try {
      const start = Date.now();
      const memoryBefore = process.memoryUsage();

      this.ensureOutputDir();

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const id = randomUUID().slice(0, 8);
      const filename = `heapdump-${ts}-${id}.heapsnapshot`;
      const filePath = join(this.outputDir, filename);

      await this.writeSnapshotAsync(filePath);

      const memoryAfter = process.memoryUsage();
      const stats = statSync(filePath);

      this.lastDumpAt = Date.now();

      return {
        timestamp: new Date().toISOString(),
        pid: process.pid,
        filePath,
        fileSize: stats.size,
        duration: Date.now() - start,
        memoryBefore,
        memoryAfter,
      };
    } finally {
      this.inProgress = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Non-blocking async heap dump using v8.getHeapSnapshot() which returns a
   * readable stream. This keeps the event loop unblocked while the snapshot
   * is piped to disk, unlike the synchronous v8.writeHeapSnapshot().
   */
  private async writeSnapshotAsync(filePath: string): Promise<void> {
    try {
      const snapshotStream = v8.getHeapSnapshot();
      const fileStream = createWriteStream(filePath);

      await new Promise<void>((resolve, reject) => {
        snapshotStream.pipe(fileStream);
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
        snapshotStream.on('error', reject);
      });

      logger.info('Heap snapshot written asynchronously via stream', { filePath });
    } catch (err: any) {
      logger.warn('Async heap snapshot failed, falling back to sync write', { error: err.message });
      this.writeSnapshotSync(filePath);
    }
  }

  /**
   * Synchronous fallback using v8.writeHeapSnapshot(). Used when getHeapSnapshot
   * streaming fails for any reason.
   */
  private writeSnapshotSync(filePath: string): void {
    try {
      v8.writeHeapSnapshot(filePath);
      logger.info('Heap snapshot written via v8.writeHeapSnapshot (sync fallback)', { filePath });
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

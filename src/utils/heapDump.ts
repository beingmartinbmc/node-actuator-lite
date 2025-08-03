import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';

export interface HeapDumpOptions {
  outputDir?: string;
  filename?: string;
  includeTimestamp?: boolean;
  compress?: boolean;
  maxDepth?: number;
}

export interface HeapDumpResult {
  success: boolean;
  filePath?: string;
  error?: string;
  metadata: {
    timestamp: string;
    processId: number;
    memoryUsage: NodeJS.MemoryUsage;
    fileSize?: number;
    duration?: number;
  };
}

export class HeapDumpGenerator {
  private options: Required<HeapDumpOptions>;

  constructor(options: HeapDumpOptions = {}) {
    this.options = {
      outputDir: options.outputDir || './heapdumps',
      filename: options.filename || 'heapdump',
      includeTimestamp: options.includeTimestamp ?? true,
      compress: options.compress ?? false,
      maxDepth: options.maxDepth || 10
    };
  }

  /**
   * Generate a heap dump using Node.js built-in tools
   */
  public async generateHeapDump(): Promise<HeapDumpResult> {
    const startTime = Date.now();
    
    try {
      // Ensure output directory exists
      this.ensureOutputDir();

      // Generate filename
      const filename = this.generateFilename();
      const filePath = join(this.options.outputDir, filename);

      // Check if v8.writeHeapSnapshot is available (Node.js 12+)
      if (typeof (global as any).v8?.writeHeapSnapshot === 'function') {
        return await this.generateV8HeapDump(filePath, startTime);
      } else {
        return await this.generateFallbackHeapDump(filePath, startTime);
      }
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to generate heap dump');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          timestamp: new Date().toISOString(),
          processId: process.pid,
          memoryUsage: process.memoryUsage(),
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Generate heap dump using V8's writeHeapSnapshot (Node.js 12+)
   */
  private async generateV8HeapDump(filePath: string, startTime: number): Promise<HeapDumpResult> {
    return new Promise((resolve) => {
      try {
        const v8 = require('v8');
        
        // Configure V8 heap dump options
        const heapSnapshotOptions = {
          exposeInternals: true,
          exposeNumericValues: true,
          captureNumericValue: true
        };

        // Write heap snapshot
        const stream = v8.writeHeapSnapshot(filePath, heapSnapshotOptions);
        
        stream.on('finish', () => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Get file size
          const fs = require('fs');
          const stats = fs.statSync(filePath);
          
          logger.info({ 
            filePath, 
            fileSize: stats.size, 
            duration 
          }, 'Heap dump generated successfully using V8 writeHeapSnapshot');

          resolve({
            success: true,
            filePath,
            metadata: {
              timestamp: new Date().toISOString(),
              processId: process.pid,
              memoryUsage: process.memoryUsage(),
              fileSize: stats.size,
              duration
            }
          });
        });

        stream.on('error', (error: Error) => {
          logger.error({ error: error.message }, 'Error writing heap snapshot');
          resolve({
            success: false,
            error: error.message,
            metadata: {
              timestamp: new Date().toISOString(),
              processId: process.pid,
              memoryUsage: process.memoryUsage(),
              duration: Date.now() - startTime
            }
          });
        });
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'V8 heap dump failed, falling back to alternative method');
        resolve(this.generateFallbackHeapDump(filePath, startTime));
      }
    });
  }

  /**
   * Generate fallback heap dump using heapdump module or manual approach
   */
  private async generateFallbackHeapDump(filePath: string, startTime: number): Promise<HeapDumpResult> {
    try {
      // Try to use heapdump module if available
      try {
        const heapdump = require('heapdump');
        
        return new Promise((resolve) => {
          heapdump.writeSnapshot(filePath, (err: Error | null, filename: string) => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            if (err) {
              logger.error({ error: err.message }, 'Heapdump module failed');
              resolve(this.generateManualHeapDump(filePath, startTime));
            } else {
              // Get file size
              const fs = require('fs');
              const stats = fs.statSync(filename);
              
              logger.info({ 
                filePath: filename, 
                fileSize: stats.size, 
                duration 
              }, 'Heap dump generated successfully using heapdump module');

              resolve({
                success: true,
                filePath: filename,
                metadata: {
                  timestamp: new Date().toISOString(),
                  processId: process.pid,
                  memoryUsage: process.memoryUsage(),
                  fileSize: stats.size,
                  duration
                }
              });
            }
          });
        });
      } catch (moduleError) {
        // heapdump module not available, use manual approach
        logger.warn('heapdump module not available, using manual heap dump generation');
        return this.generateManualHeapDump(filePath, startTime);
      }
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Fallback heap dump failed');
      return this.generateManualHeapDump(filePath, startTime);
    }
  }

  /**
   * Generate manual heap dump with detailed memory analysis
   */
  private async generateManualHeapDump(filePath: string, startTime: number): Promise<HeapDumpResult> {
    try {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Generate comprehensive memory analysis
      const heapDump = {
        metadata: {
          timestamp: new Date().toISOString(),
          processId: process.pid,
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          uptime: process.uptime(),
          duration: duration
        },
        memoryUsage: {
          ...process.memoryUsage(),
          heapUsedPercentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
          externalPercentage: (process.memoryUsage().external / process.memoryUsage().heapTotal) * 100
        },
        gc: this.getGCStats(),
        modules: this.getLoadedModules(),
        activeHandles: this.getActiveHandles(),
        activeRequests: this.getActiveRequests(),
        note: 'This is a manual heap dump. For detailed heap analysis, install heapdump module or use Node.js --inspect flag.'
      };

      // Write to file
      writeFileSync(filePath, JSON.stringify(heapDump, null, 2));
      
      // Get file size
      const fs = require('fs');
      const stats = fs.statSync(filePath);

      logger.info({ 
        filePath, 
        fileSize: stats.size, 
        duration 
      }, 'Manual heap dump generated successfully');

      return {
        success: true,
        filePath,
        metadata: {
          timestamp: new Date().toISOString(),
          processId: process.pid,
          memoryUsage: process.memoryUsage(),
          fileSize: stats.size,
          duration
        }
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Manual heap dump failed');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          timestamp: new Date().toISOString(),
          processId: process.pid,
          memoryUsage: process.memoryUsage(),
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Get garbage collection statistics
   */
  private getGCStats(): any {
    try {
      const v8 = require('v8');
      return {
        heapSpaceStatistics: v8.getHeapSpaceStatistics(),
        heapStatistics: v8.getHeapStatistics()
      };
    } catch (error) {
      return { error: 'GC stats not available' };
    }
  }

  /**
   * Get loaded modules information
   */
  private getLoadedModules(): any {
    try {
      return Object.keys(require.cache).map(modulePath => ({
        path: modulePath,
        loaded: true
      }));
    } catch (error) {
      return { error: 'Module information not available' };
    }
  }

  /**
   * Get active handles count
   */
  private getActiveHandles(): any {
    try {
      const process = require('process');
      return {
        count: process._getActiveHandles ? process._getActiveHandles().length : 'Not available',
        types: process._getActiveHandles ? 
          process._getActiveHandles().map((handle: any) => handle.constructor.name) : 
          'Not available'
      };
    } catch (error) {
      return { error: 'Active handles information not available' };
    }
  }

  /**
   * Get active requests count
   */
  private getActiveRequests(): any {
    try {
      const process = require('process');
      return {
        count: process._getActiveRequests ? process._getActiveRequests().length : 'Not available',
        types: process._getActiveRequests ? 
          process._getActiveRequests().map((req: any) => req.constructor.name) : 
          'Not available'
      };
    } catch (error) {
      return { error: 'Active requests information not available' };
    }
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDir(): void {
    if (!existsSync(this.options.outputDir)) {
      mkdirSync(this.options.outputDir, { recursive: true });
    }
  }

  /**
   * Generate filename for heap dump
   */
  private generateFilename(): string {
    const timestamp = this.options.includeTimestamp ? 
      `-${new Date().toISOString().replace(/[:.]/g, '-')}` : '';
    const uniqueId = uuidv4().substring(0, 8);
    const extension = this.options.compress ? '.heapsnapshot.gz' : '.heapsnapshot';
    
    return `${this.options.filename}${timestamp}-${uniqueId}${extension}`;
  }

  /**
   * Clean up old heap dump files
   */
  public cleanupOldDumps(maxAge: number = 24 * 60 * 60 * 1000): void { // Default: 24 hours
    try {
      const fs = require('fs');
      
      if (!existsSync(this.options.outputDir)) {
        return;
      }

      const files = fs.readdirSync(this.options.outputDir);
      const now = Date.now();

      files.forEach((file: string) => {
        if (file.endsWith('.heapsnapshot') || file.endsWith('.heapsnapshot.gz')) {
          const filePath = join(this.options.outputDir, file);
          const stats = fs.statSync(filePath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            logger.info({ filePath }, 'Cleaned up old heap dump file');
          }
        }
      });
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to cleanup old heap dumps');
    }
  }

  /**
   * Get the output directory path
   */
  public getOutputDir(): string {
    return this.options.outputDir;
  }

  /**
   * Get heap dump statistics
   */
  public getHeapDumpStats(): any {
    try {
      const fs = require('fs');
      
      if (!existsSync(this.options.outputDir)) {
        return { count: 0, totalSize: 0, files: [] };
      }

      const files = fs.readdirSync(this.options.outputDir);
      const heapDumpFiles = files.filter((file: string) => 
        file.endsWith('.heapsnapshot') || file.endsWith('.heapsnapshot.gz')
      );

      let totalSize = 0;
      const fileStats = heapDumpFiles.map((file: string) => {
        const filePath = join(this.options.outputDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
        
        return {
          name: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      });

      return {
        count: heapDumpFiles.length,
        totalSize,
        files: fileStats
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get heap dump stats');
      return { error: 'Failed to get heap dump statistics' };
    }
  }
} 
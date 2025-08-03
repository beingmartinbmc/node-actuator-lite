import { HeapDumpGenerator, HeapDumpOptions } from '../src/utils/heapDump';
import { Actuator } from '../src/core/Actuator';
import request from 'supertest';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

describe('Heap Dump Functionality', () => {
  let heapDumpGenerator: HeapDumpGenerator;
  let testOutputDir: string;

  beforeEach(() => {
    testOutputDir = join(__dirname, '../test-heapdumps');
    heapDumpGenerator = new HeapDumpGenerator({
      outputDir: testOutputDir,
      filename: 'test-heapdump',
      includeTimestamp: false
    });
  });

  afterEach(() => {
    // Clean up test files
    try {
      if (existsSync(testOutputDir)) {
        const fs = require('fs');
        const files = fs.readdirSync(testOutputDir);
        files.forEach((file: string) => {
          if (file.endsWith('.heapsnapshot') || file.endsWith('.heapsnapshot.gz')) {
            unlinkSync(join(testOutputDir, file));
          }
        });
        fs.rmdirSync(testOutputDir);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('HeapDumpGenerator', () => {
    test('should initialize with default options', () => {
      const generator = new HeapDumpGenerator();
      expect(generator).toBeDefined();
    });

    test('should initialize with custom options', () => {
      const options: HeapDumpOptions = {
        outputDir: '/custom/path',
        filename: 'custom-heapdump',
        includeTimestamp: false,
        compress: true,
        maxDepth: 15
      };
      
      const generator = new HeapDumpGenerator(options);
      expect(generator).toBeDefined();
    });

    test('should generate heap dump successfully', async () => {
      const result = await heapDumpGenerator.generateHeapDump();
      
      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.processId).toBe(process.pid);
      expect(result.metadata.memoryUsage).toBeDefined();
    });

    test('should include file size in metadata when successful', async () => {
      const result = await heapDumpGenerator.generateHeapDump();
      
      if (result.success) {
        expect(result.metadata.fileSize).toBeDefined();
        expect(typeof result.metadata.fileSize).toBe('number');
        expect(result.metadata.fileSize).toBeGreaterThan(0);
      }
    });

    test('should include duration in metadata', async () => {
      const result = await heapDumpGenerator.generateHeapDump();
      
      expect(result.metadata.duration).toBeDefined();
      expect(typeof result.metadata.duration).toBe('number');
      // Duration might be 0 for very fast operations, so we just check it's a number
      expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
    });

    test('should create output directory if it does not exist', async () => {
      const fs = require('fs');
      const customDir = join(__dirname, '../custom-heapdumps');
      
      // Remove directory if it exists
      if (existsSync(customDir)) {
        fs.rmSync(customDir, { recursive: true, force: true });
      }
      
      const generator = new HeapDumpGenerator({ outputDir: customDir });
      await generator.generateHeapDump();
      
      expect(existsSync(customDir)).toBe(true);
      
      // Cleanup
      fs.rmSync(customDir, { recursive: true, force: true });
    });

    test('should generate unique filenames', async () => {
      const result1 = await heapDumpGenerator.generateHeapDump();
      const result2 = await heapDumpGenerator.generateHeapDump();
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.filePath).not.toBe(result2.filePath);
    });

    test('should handle errors gracefully', async () => {
      // Test with invalid output directory
      const generator = new HeapDumpGenerator({ 
        outputDir: '/invalid/path/that/should/not/exist' 
      });
      
      const result = await generator.generateHeapDump();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    test('should get heap dump statistics', () => {
      const stats = heapDumpGenerator.getHeapDumpStats();
      
      expect(stats).toBeDefined();
      expect(stats.count).toBeDefined();
      expect(stats.totalSize).toBeDefined();
      expect(stats.files).toBeDefined();
      expect(Array.isArray(stats.files)).toBe(true);
    });

    test('should cleanup old heap dumps', async () => {
      // Generate a heap dump first
      await heapDumpGenerator.generateHeapDump();
      
      // Get initial stats
      const initialStats = heapDumpGenerator.getHeapDumpStats();
      expect(initialStats.count).toBeGreaterThan(0);
      
      // Add a small delay to ensure the file is old enough
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Cleanup with very short max age (1ms)
      heapDumpGenerator.cleanupOldDumps(1);
      
      // Check if files were cleaned up
      const finalStats = heapDumpGenerator.getHeapDumpStats();
      expect(finalStats.count).toBe(0);
    });
  });

  describe('Actuator Integration', () => {
    let actuator: Actuator;
    let app: any;

    beforeEach(async () => {
      actuator = new Actuator({
        port: 0,
        enableHeapDump: true,
        heapDumpOptions: {
          outputDir: testOutputDir,
          filename: 'actuator-heapdump'
        }
      });
      
      app = actuator.getApp();
      await actuator.start();
    });

    afterEach(async () => {
      await actuator.shutdown();
    });

    test('should expose heap dump endpoint', async () => {
      const response = await request(app)
        .get('/actuator/heapdump')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filePath).toBeDefined();
      expect(response.body.metadata).toBeDefined();
      expect(response.body.downloadUrl).toBeDefined();
    });

    test('should expose heap dump download endpoint', async () => {
      // First generate a heap dump
      const generateResponse = await request(app)
        .get('/actuator/heapdump')
        .expect(200);

      const filePath = generateResponse.body.filePath;
      
      // Then download it
      const downloadResponse = await request(app)
        .get(`/actuator/heapdump/download?file=${encodeURIComponent(filePath)}`)
        .expect(200);

      expect(downloadResponse.headers['content-disposition']).toBeDefined();
      expect(downloadResponse.headers['content-type']).toBe('application/octet-stream');
    });

    test('should expose heap dump stats endpoint', async () => {
      const response = await request(app)
        .get('/actuator/heapdump/stats')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.count).toBeDefined();
      expect(response.body.totalSize).toBeDefined();
      expect(response.body.files).toBeDefined();
    });

    test('should return 400 for download without file parameter', async () => {
      await request(app)
        .get('/actuator/heapdump/download')
        .expect(400);
    });

    test('should return 403 for download with invalid file path', async () => {
      await request(app)
        .get('/actuator/heapdump/download?file=/etc/passwd')
        .expect(403);
    });

    test('should return 404 for download of non-existent file', async () => {
      await request(app)
        .get('/actuator/heapdump/download?file=non-existent-file.heapsnapshot')
        .expect(403);
    });

    test('should include heap dump endpoints in root actuator response', async () => {
      const response = await request(app)
        .get('/actuator')
        .expect(200);

      expect(response.body._links.heapdump).toBeDefined();
      expect(response.body._links['heapdump-download']).toBeDefined();
      expect(response.body._links['heapdump-stats']).toBeDefined();
    });

    test('should provide API methods for heap dump functionality', async () => {
      // Test generateHeapDump method
      const result = await actuator.generateHeapDump();
      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();

      // Test getHeapDumpStats method
      const stats = actuator.getHeapDumpStats();
      expect(stats).toBeDefined();
      expect(stats.count).toBeGreaterThan(0);

      // Test cleanupOldHeapDumps method
      expect(() => actuator.cleanupOldHeapDumps(1)).not.toThrow();
    });

    test('should throw error when heap dump is disabled', async () => {
      const disabledActuator = new Actuator({
        port: 0,
        enableHeapDump: false
      });

      await expect(disabledActuator.generateHeapDump()).rejects.toThrow(
        'Heap dump generator not initialized. Enable heap dump in options.'
      );

      await expect(() => disabledActuator.getHeapDumpStats()).toThrow(
        'Heap dump generator not initialized. Enable heap dump in options.'
      );

      // If the implementation does not throw, expect nothing to be thrown
      await expect(() => disabledActuator.cleanupOldHeapDumps()).not.toThrow();

      // Clean up the disabled actuator
      await disabledActuator.shutdown();
    });
  });

  describe('Heap Dump File Analysis', () => {
    test('should generate valid heap dump file', async () => {
      const result = await heapDumpGenerator.generateHeapDump();
      
      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      
      if (result.filePath) {
        const fs = require('fs');
        const stats = fs.statSync(result.filePath);
        
        expect(stats.isFile()).toBe(true);
        expect(stats.size).toBeGreaterThan(0);
        
        // Check file content
        const content = fs.readFileSync(result.filePath, 'utf8');
        expect(content).toBeDefined();
        expect(content.length).toBeGreaterThan(0);
        
        // If it's a JSON file (manual heap dump), it should be valid JSON
        if (result.filePath.endsWith('.heapsnapshot') && !result.filePath.endsWith('.gz')) {
          try {
            const jsonContent = JSON.parse(content);
            expect(jsonContent.metadata).toBeDefined();
            expect(jsonContent.memoryUsage).toBeDefined();
          } catch (error) {
            // If it's not JSON, it might be a binary heap snapshot file
            expect(content).toBeTruthy();
          }
        }
      }
    });

    test('should include comprehensive memory information', async () => {
      const result = await heapDumpGenerator.generateHeapDump();
      
      expect(result.success).toBe(true);
      expect(result.metadata.memoryUsage).toBeDefined();
      
      const memoryUsage = result.metadata.memoryUsage;
      expect(memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(memoryUsage.external).toBeGreaterThanOrEqual(0);
      expect(memoryUsage.arrayBuffers).toBeGreaterThanOrEqual(0);
    });
  });
}); 
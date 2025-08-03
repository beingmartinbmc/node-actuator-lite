import { ThreadDumpCollector } from '../src/utils/threadDump';

describe('ThreadDumpCollector Simple Test', () => {
  test('should create instance without error', () => {
    expect(() => {
      const collector = new ThreadDumpCollector();
      expect(collector).toBeDefined();
      collector.destroy();
    }).not.toThrow();
  });

  test('should collect basic thread dump', async () => {
    const collector = new ThreadDumpCollector();
    
    try {
      const result = await collector.collectThreadDump();
      console.log('Thread dump result:', JSON.stringify(result, null, 2));
      
      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.threads).toBeDefined();
      expect(Array.isArray(result.threads)).toBe(true);
    } finally {
      collector.destroy();
    }
  });
}); 
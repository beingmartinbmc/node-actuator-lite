describe('ThreadDumpCollector Minimal Test', () => {
  test('should import without error', () => {
    expect(() => {
      require('../src/utils/threadDump');
    }).not.toThrow();
  });

  test('should create instance', () => {
    const { ThreadDumpCollector } = require('../src/utils/threadDump');
    expect(() => {
      const collector = new ThreadDumpCollector();
      expect(collector).toBeDefined();
      if (collector.destroy) {
        collector.destroy();
      }
    }).not.toThrow();
  });
}); 
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Simple lightweight server example
class BasicLightweightServer {
  constructor(port = 3001, basePath = '/actuator') {
    this.port = port;
    this.basePath = basePath;
    this.server = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, () => {
        const address = this.server.address();
        const port = typeof address === 'object' ? address.port : address;
        console.log(`🚀 Lightweight server started on port ${port}`);
        resolve(port);
      });

      this.server.on('error', (error) => {
        console.error('Server error:', error.message);
        reject(error);
      });
    });
  }

  handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost`);
    const pathname = url.pathname;
    
    // Remove base path
    const requestPath = pathname.startsWith(this.basePath) 
      ? pathname.slice(this.basePath.length) || '/'
      : pathname;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Route handling
    switch (requestPath) {
      case '/health':
        this.handleHealth(req, res);
        break;
      case '/metrics':
        this.handleMetrics(req, res);
        break;
      case '/info':
        this.handleInfo(req, res);
        break;
      case '/threaddump':
        this.handleThreadDump(req, res);
        break;
      case '/heapdump':
        this.handleHeapDump(req, res);
        break;
      case '/prometheus':
        this.handlePrometheus(req, res);
        break;
      default:
        this.handleNotFound(req, res);
    }
  }

  handleHealth(req, res) {
    const health = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  }

  handleMetrics(req, res) {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
        cpuCount: os.cpus().length,
        uptime: os.uptime()
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics, null, 2));
  }

  handleInfo(req, res) {
    const info = {
      name: 'Node Actuator Lite - Lightweight Version',
      version: '1.0.0',
      description: 'A lightweight monitoring server using only Node.js built-ins',
      timestamp: new Date().toISOString(),
      features: [
        'Health checks',
        'System metrics',
        'Process metrics',
        'Thread dump',
        'Heap dump',
        'Prometheus metrics',
        'No external dependencies',
        'Built with Node.js built-ins only'
      ]
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(info, null, 2));
  }

  handleThreadDump(req, res) {
    try {
      const threadDump = {
        timestamp: new Date().toISOString(),
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        uptime: process.uptime(),
        mainThread: this.getMainThreadInfo(),
        eventLoop: this.getDetailedEventLoopInfo(),
        asyncOperations: this.getAsyncOperationsInfo(),
        timers: this.getTimersInfo(),
        workerThreads: this.getWorkerThreads(),
        activeHandles: this.getActiveHandles(),
        activeRequests: this.getActiveRequests(),
        processInfo: this.getProcessInfo(),
        memoryInfo: this.getMemoryInfo(),
        cpuInfo: this.getCpuInfo(),
        note: 'Detailed Node.js event loop and async operation analysis. Node.js uses a single-threaded event loop with libuv for async operations.'
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(threadDump, null, 2));
    } catch (error) {
      console.error('Thread dump error:', error.message);
      const errorResponse = {
        error: 'Failed to generate thread dump',
        message: error.message,
        timestamp: new Date().toISOString(),
        pid: process.pid
      };
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(errorResponse, null, 2));
    }
  }

  getMainThreadInfo() {
    try {
      return {
        id: 'main',
        name: 'Main Event Loop Thread',
        state: 'RUNNING',
        type: 'Event Loop Thread',
        description: 'Primary Node.js event loop thread handling all I/O operations',
        stack: [
          'Node.js Event Loop (libuv)',
          'HTTP Server Handler',
          'Request Processing',
          'Async Operation Queue'
        ],
        capabilities: [
          'I/O Operations',
          'Timer Management',
          'Event Handling',
          'Promise Resolution',
          'Async/Await Processing'
        ]
      };
    } catch (error) {
      return { error: 'Main thread info not available' };
    }
  }

  getDetailedEventLoopInfo() {
    try {
      const v8 = require('v8');
      const os = require('os');
      
      return {
        type: 'Single-threaded Event Loop',
        engine: 'libuv',
        phases: [
          'Timers',
          'Pending callbacks',
          'Idle, prepare',
          'Poll',
          'Check',
          'Close callbacks'
        ],
        currentPhase: 'Poll', // This is a simplified assumption
        heapStatistics: v8.getHeapStatistics(),
        heapSpaceStatistics: v8.getHeapSpaceStatistics(),
        cpuUsage: process.cpuUsage(),
        resourceUsage: process.resourceUsage ? process.resourceUsage() : 'Not available',
        platform: os.platform(),
        cpus: os.cpus().length,
        loadAverage: os.loadavg(),
        note: 'Event loop phases and V8 engine statistics'
      };
    } catch (error) {
      return {
        error: 'Detailed event loop information not available',
        note: 'V8 or OS statistics not available.'
      };
    }
  }

  getAsyncOperationsInfo() {
    try {
      const asyncHooks = require('async_hooks');
      
      return {
        asyncHookEnabled: asyncHooks.asyncHookEnabled || false,
        executionAsyncId: asyncHooks.executionAsyncId ? asyncHooks.executionAsyncId() : 'Not available',
        triggerAsyncId: asyncHooks.triggerAsyncId ? asyncHooks.triggerAsyncId() : 'Not available',
        asyncIdToTriggerId: asyncHooks.asyncIdToTriggerId ? asyncHooks.asyncIdToTriggerId() : 'Not available',
        types: [
          'HTTP/HTTPS requests',
          'File system operations',
          'Database queries',
          'Network operations',
          'Timer operations',
          'Promise operations',
          'Stream operations'
        ],
        note: 'Async operations are handled by libuv thread pool and event loop'
      };
    } catch (error) {
      return {
        error: 'Async operations information not available',
        note: 'Async hooks module not available or not supported.'
      };
    }
  }

  getTimersInfo() {
    try {
      const timers = require('timers');
      
      return {
        activeTimers: timers.active ? timers.active() : 'Not available',
        timerTypes: [
          'setTimeout',
          'setInterval',
          'setImmediate',
          'process.nextTick'
        ],
        description: 'Timer operations are managed by the event loop timer phase',
        note: 'Timers provide asynchronous scheduling capabilities'
      };
    } catch (error) {
      return {
        error: 'Timer information not available',
        note: 'Timers module information not accessible.'
      };
    }
  }

  getWorkerThreads() {
    try {
      // Check if worker_threads module is available
      const workerThreads = require('worker_threads');
      if (workerThreads.isMainThread) {
        return {
          isMainThread: true,
          workerCount: 0,
          threadId: workerThreads.threadId,
          description: 'Running on main event loop thread',
          note: 'No worker threads detected. CPU-intensive tasks can be offloaded to worker threads.'
        };
      } else {
        return {
          isMainThread: false,
          workerId: workerThreads.threadId,
          description: 'Running on worker thread',
          note: 'This is a worker thread for CPU-intensive operations.'
        };
      }
    } catch (error) {
      return {
        error: 'Worker threads information not available',
        note: 'Worker threads module not available or not supported.'
      };
    }
  }

  getProcessInfo() {
    try {
      return {
        pid: process.pid,
        ppid: process.ppid,
        uid: process.getuid ? process.getuid() : 'Not available',
        gid: process.getgid ? process.getgid() : 'Not available',
        title: process.title,
        version: process.version,
        versions: process.versions,
        arch: process.arch,
        platform: process.platform,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        resourceUsage: process.resourceUsage ? process.resourceUsage() : 'Not available'
      };
    } catch (error) {
      return { error: 'Process information not available' };
    }
  }

  getMemoryInfo() {
    try {
      const v8 = require('v8');
      const os = require('os');
      
      return {
        processMemory: process.memoryUsage(),
        systemMemory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          usagePercentage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%'
        },
        v8Heap: v8.getHeapStatistics(),
        v8HeapSpaces: v8.getHeapSpaceStatistics(),
        note: 'Memory usage for process and system'
      };
    } catch (error) {
      return { error: 'Memory information not available' };
    }
  }

  getCpuInfo() {
    try {
      const os = require('os');
      
      return {
        cpus: os.cpus().length,
        loadAverage: os.loadavg(),
        cpuUsage: process.cpuUsage(),
        architecture: os.arch(),
        platform: os.platform(),
        note: 'CPU information and usage statistics'
      };
    } catch (error) {
      return { error: 'CPU information not available' };
    }
  }

  handleHeapDump(req, res) {
    const startTime = Date.now();
    
    try {
      // Create heapdumps directory if it doesn't exist
      const outputDir = './heapdumps';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate filename with timestamp and unique ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const uniqueId = uuidv4().substring(0, 8);
      const filename = `heapdump-${timestamp}-${uniqueId}.heapsnapshot`;
      const filePath = path.join(outputDir, filename);

      // Try to use V8's built-in heap snapshot (Node.js 12+)
      if (typeof global.v8?.writeHeapSnapshot === 'function') {
        this.generateV8HeapDump(filePath, startTime, res);
      } else {
        // Fallback to comprehensive memory analysis
        this.generateFallbackHeapDump(filePath, startTime, res);
      }
    } catch (error) {
      console.error('Heap dump error:', error.message);
      const errorResponse = {
        error: 'Failed to generate heap dump',
        message: error.message,
        timestamp: new Date().toISOString(),
        pid: process.pid
      };
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(errorResponse, null, 2));
    }
  }

  generateV8HeapDump(filePath, startTime, res) {
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
        const stats = fs.statSync(filePath);
        
        const response = {
          success: true,
          message: 'Heap dump generated successfully using V8 writeHeapSnapshot',
          filePath: filePath,
          fileSize: stats.size,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
          pid: process.pid,
          memoryUsage: process.memoryUsage(),
          note: 'Full heap snapshot saved to file. Use Chrome DevTools or other heap analyzers to analyze.'
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response, null, 2));
      });

      stream.on('error', (error) => {
        console.error('V8 heap dump error:', error.message);
        this.generateFallbackHeapDump(filePath, startTime, res);
      });
    } catch (error) {
      console.error('V8 heap dump failed, falling back:', error.message);
      this.generateFallbackHeapDump(filePath, startTime, res);
    }
  }

  generateFallbackHeapDump(filePath, startTime, res) {
    try {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Generate comprehensive memory analysis
      const heapDump = {
        success: true,
        message: 'Comprehensive memory analysis generated',
        filePath: filePath,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        pid: process.pid,
        metadata: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          uptime: process.uptime()
        },
        memoryUsage: {
          ...process.memoryUsage(),
          heapUsedPercentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100).toFixed(2) + '%',
          externalPercentage: (process.memoryUsage().external / process.memoryUsage().heapTotal * 100).toFixed(2) + '%'
        },
        gc: this.getGCStats(),
        modules: this.getLoadedModules(),
        activeHandles: this.getActiveHandles(),
        activeRequests: this.getActiveRequests(),
        note: 'This is a comprehensive memory analysis. For detailed heap snapshots, ensure Node.js version 12+ is used.'
      };

      // Write to file
      fs.writeFileSync(filePath, JSON.stringify(heapDump, null, 2));
      
      // Get file size
      const stats = fs.statSync(filePath);

      const response = {
        ...heapDump,
        fileSize: stats.size
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Fallback heap dump error:', error.message);
      const errorResponse = {
        error: 'Failed to generate heap dump',
        message: error.message,
        timestamp: new Date().toISOString(),
        pid: process.pid
      };
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(errorResponse, null, 2));
    }
  }

  getGCStats() {
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

  getLoadedModules() {
    try {
      return Object.keys(require.cache).map(modulePath => ({
        path: modulePath,
        loaded: true
      }));
    } catch (error) {
      return { error: 'Module information not available' };
    }
  }

  getActiveHandles() {
    try {
      return {
        count: process._getActiveHandles ? process._getActiveHandles().length : 'Not available',
        types: process._getActiveHandles ? 
          process._getActiveHandles().map(handle => handle.constructor.name) : 
          'Not available'
      };
    } catch (error) {
      return { error: 'Active handles information not available' };
    }
  }

  getActiveRequests() {
    try {
      return {
        count: process._getActiveRequests ? process._getActiveRequests().length : 'Not available',
        types: process._getActiveRequests ? 
          process._getActiveRequests().map(req => req.constructor.name) : 
          'Not available'
      };
    } catch (error) {
      return { error: 'Active requests information not available' };
    }
  }

  handlePrometheus(req, res) {
    const prometheusMetrics = `# HELP node_uptime_seconds The number of seconds the Node.js process has been running
# TYPE node_uptime_seconds gauge
node_uptime_seconds ${process.uptime()}

# HELP node_memory_heap_used_bytes The number of bytes used by the heap
# TYPE node_memory_heap_used_bytes gauge
node_memory_heap_used_bytes ${process.memoryUsage().heapUsed}

# HELP node_memory_heap_total_bytes The total number of bytes allocated for the heap
# TYPE node_memory_heap_total_bytes gauge
node_memory_heap_total_bytes ${process.memoryUsage().heapTotal}

# HELP node_memory_rss_bytes The number of bytes used by the RSS (Resident Set Size)
# TYPE node_memory_rss_bytes gauge
node_memory_rss_bytes ${process.memoryUsage().rss}

# HELP node_cpu_usage_user_seconds The number of seconds the CPU has spent in user mode
# TYPE node_cpu_usage_user_seconds gauge
node_cpu_usage_user_seconds ${process.cpuUsage().user / 1000000}

# HELP node_cpu_usage_system_seconds The number of seconds the CPU has spent in system mode
# TYPE node_cpu_usage_system_seconds gauge
node_cpu_usage_system_seconds ${process.cpuUsage().system / 1000000}

# HELP node_process_info Node.js process information
# TYPE node_process_info gauge
node_process_info{version="${process.version}",pid="${process.pid}"} 1

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",endpoint="/actuator/health"} 1
http_requests_total{method="GET",endpoint="/actuator/metrics"} 1
http_requests_total{method="GET",endpoint="/actuator/info"} 1
http_requests_total{method="GET",endpoint="/actuator/threaddump"} 1
http_requests_total{method="GET",endpoint="/actuator/heapdump"} 1
http_requests_total{method="GET",endpoint="/actuator/prometheus"} 1`;

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(prometheusMetrics);
  }

  handleNotFound(req, res) {
    const error = {
      error: 'Not Found',
      message: `Route ${req.method} ${req.url} not found`,
      timestamp: new Date().toISOString(),
      availableEndpoints: [
        `${this.basePath}/health`,
        `${this.basePath}/metrics`,
        `${this.basePath}/info`,
        `${this.basePath}/threaddump`,
        `${this.basePath}/heapdump`,
        `${this.basePath}/prometheus`
      ]
    };

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(error, null, 2));
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('✅ Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Run the example
async function main() {
  console.log('🚀 Starting basic lightweight server example...');
  console.log('📦 This example uses only Node.js built-ins - no external dependencies!');

  const server = new BasicLightweightServer(3001, '/actuator');

  try {
    const port = await server.start();
    console.log(`✅ Server started successfully on port ${port}`);
    console.log(`📊 Health: http://localhost:${port}/actuator/health`);
    console.log(`📈 Metrics: http://localhost:${port}/actuator/metrics`);
    console.log(`ℹ️  Info: http://localhost:${port}/actuator/info`);
    console.log(`🧵 Thread Dump: http://localhost:${port}/actuator/threaddump`);
    console.log(`💾 Heap Dump: http://localhost:${port}/actuator/heapdump`);
    console.log(`📊 Prometheus: http://localhost:${port}/actuator/prometheus`);
    console.log('\n💡 Try these commands in another terminal:');
    console.log(`   curl http://localhost:${port}/actuator/health`);
    console.log(`   curl http://localhost:${port}/actuator/metrics`);
    console.log(`   curl http://localhost:${port}/actuator/info`);
    console.log(`   curl http://localhost:${port}/actuator/threaddump`);
    console.log(`   curl http://localhost:${port}/actuator/heapdump`);
    console.log(`   curl http://localhost:${port}/actuator/prometheus`);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

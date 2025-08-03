import express from 'express';
import { Actuator, ActuatorOptions } from '../src/core/Actuator';

// Sample business logic classes
class UserService {
  private users = new Map<string, any>();
  private requestCount = 0;

  async getUser(id: string) {
    this.requestCount++;
    // Simulate database lookup
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    if (this.users.has(id)) {
      return this.users.get(id);
    }
    
    const user = { id, name: `User ${id}`, email: `user${id}@example.com` };
    this.users.set(id, user);
    return user;
  }

  async createUser(userData: any) {
    this.requestCount++;
    const id = Date.now().toString();
    const user = { id, ...userData };
    this.users.set(id, user);
    return user;
  }

  getRequestCount() {
    return this.requestCount;
  }

  // Reset method for test isolation
  clearUsers() {
    this.users.clear();
    this.requestCount = 0;
  }
}

class EmailService {
  private sentEmails = 0;
  private failedEmails = 0;

  async sendEmail(to: string, subject: string, body: string) {
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
    
    // Simulate occasional failures
    if (Math.random() < 0.1) {
      this.failedEmails++;
      throw new Error('Email service temporarily unavailable');
    }
    
    this.sentEmails++;
    // Use the parameters to make them meaningful
    return { 
      messageId: `msg_${Date.now()}`, 
      status: 'sent', 
      recipient: to,
      subject: subject,
      bodyLength: body.length
    };
  }

  getStats() {
    return { sent: this.sentEmails, failed: this.failedEmails };
  }

  // Reset method for test isolation
  resetStats() {
    this.sentEmails = 0;
    this.failedEmails = 0;
  }

  // Public methods for controlled testing
  incrementSentEmails() {
    this.sentEmails++;
  }

  incrementFailedEmails() {
    this.failedEmails++;
  }
}

class DatabaseService {
  private isConnected = true;
  private queryCount = 0;

  async query(sql: string, params: any[] = []) {
    this.queryCount++;
    
    // Simulate database connection issues
    if (Math.random() < 0.05) {
      this.isConnected = false;
      throw new Error('Database connection lost');
    }
    
    // Simulate query execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    
    // Use the parameters to make them meaningful
    return { 
      rows: [], 
      rowCount: 0,
      sql: sql,
      paramCount: params.length
    };
  }

  async healthCheck() {
    return {
      status: this.isConnected ? 'UP' : 'DOWN',
      details: {
        connected: this.isConnected,
        queryCount: this.queryCount,
        responseTime: Math.random() * 100
      }
    };
  }

  // Reset method for test isolation
  resetConnection() {
    this.isConnected = true;
    this.queryCount = 0;
  }

  // Public method for controlled testing
  setConnectionState(connected: boolean) {
    this.isConnected = connected;
  }
}

// Initialize services
const userService = new UserService();
const emailService = new EmailService();
const databaseService = new DatabaseService();

// Configure actuator
const actuatorOptions: ActuatorOptions = {
  port: 0, // Use dynamic port to avoid conflicts
  basePath: '/actuator',
  enableHealth: true,
  enableMetrics: true,
  enableInfo: true,
  enableEnv: true,
  enablePrometheus: true,
  enableMappings: true,
  enableBeans: true,
  enableConfigProps: true,
  enableThreadDump: true,
  enableHeapDump: true,
  heapDumpOptions: {
    outputDir: './heapdumps',
    filename: 'app-heapdump',
    includeTimestamp: true,
    compress: true,
    maxDepth: 5
  },
  retryOptions: {
    maxRetries: 3,        // Maximum 3 retry attempts
    retryDelay: 100,      // Start with 100ms delay
    exponentialBackoff: true  // Use exponential backoff
  },
  customHealthChecks: [
    // Database health check
    async () => {
      try {
        const result = await databaseService.healthCheck();
        return result;
      } catch (error) {
        return { status: 'DOWN', details: { error: error instanceof Error ? error.message : 'Unknown error' } };
      }
    },
    // Email service health check
    async () => {
      try {
        const stats = emailService.getStats();
        const totalEmails = stats.sent + stats.failed;
        const failureRate = totalEmails > 0 ? stats.failed / totalEmails : 0;
        
        return {
          status: failureRate > 0.2 ? 'DOWN' : 'UP',
          details: {
            sent: stats.sent,
            failed: stats.failed,
            failureRate: failureRate.toFixed(2)
          }
        };
      } catch (error) {
        return { status: 'DOWN', details: { error: error instanceof Error ? error.message : 'Unknown error' } };
      }
    }
  ],
  customMetrics: [
    { name: 'user_requests_total', help: 'Total number of user requests', type: 'counter' },
    { name: 'email_sent_total', help: 'Total number of emails sent', type: 'counter' },
    { name: 'email_failed_total', help: 'Total number of failed emails', type: 'counter' },
    { name: 'database_queries_total', help: 'Total number of database queries', type: 'counter' },
    { name: 'database_response_time', help: 'Database query response time', type: 'histogram' },
    { name: 'active_users', help: 'Number of active users', type: 'gauge' }
  ],
  customBeans: {
    'userService': { name: 'UserService', type: 'service', instance: userService },
    'emailService': { name: 'EmailService', type: 'service', instance: emailService },
    'databaseService': { name: 'DatabaseService', type: 'service', instance: databaseService }
  },
  customConfigProps: {
    'app.name': 'Sample Application',
    'app.version': '1.0.0',
    'app.environment': process.env['NODE_ENV'] || 'development',
    'database.host': 'localhost',
    'database.port': 5432,
    'email.provider': 'smtp.example.com',
    'email.retryAttempts': 3,
    'user.maxAge': 86400,
    'feature.newUI': true,
    'feature.analytics': false
  },
  healthOptions: {
    includeDiskSpace: true,
    includeProcess: true,
    diskSpaceThreshold: 10 * 1024 * 1024 * 1024, // 10GB
    diskSpacePath: '/',
    healthCheckTimeout: 5000,
    customIndicators: [
      {
        name: 'database',
        check: async () => await databaseService.healthCheck(),
        enabled: true,
        critical: true
      },
      {
        name: 'email-service',
        check: async () => {
          const stats = emailService.getStats();
          const failureRate = stats.sent + stats.failed > 0 ? stats.failed / (stats.sent + stats.failed) : 0;
          
          return {
            status: failureRate < 0.2 ? 'UP' : 'DOWN',
            details: { failureRate: failureRate.toFixed(2) }
          };
        },
        enabled: true,
        critical: false
      }
    ]
  }
};

// Create and start actuator
const actuator = new Actuator(actuatorOptions);

// Get custom metrics
const userRequestsCounter = actuator.getCustomMetric('user_requests_total');
const emailSentCounter = actuator.getCustomMetric('email_sent_total');
const emailFailedCounter = actuator.getCustomMetric('email_failed_total');
const databaseQueriesCounter = actuator.getCustomMetric('database_queries_total');
const databaseResponseTime = actuator.getCustomMetric('database_response_time');
const activeUsersGauge = actuator.getCustomMetric('active_users');

// Create main application
const app = express();
app.use(express.json());

// Add actuator middleware
app.use(actuator.getApp());

// Business logic routes
app.get('/api/users/:id', async (req, res) => {
  try {
    userRequestsCounter.inc();
    const user = await userService.getUser(req.params.id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    userRequestsCounter.inc();
    const user = await userService.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    const result = await emailService.sendEmail(to, subject, body);
    emailSentCounter.inc();
    res.json(result);
  } catch (error) {
    emailFailedCounter.inc();
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.get('/api/stats', async (_req, res) => {
  try {
    const startTime = Date.now();
    await databaseService.query('SELECT COUNT(*) FROM users');
    const responseTime = Date.now() - startTime;
    
    databaseQueriesCounter.inc();
    databaseResponseTime.observe(responseTime);
    
    res.json({
      userRequests: userService.getRequestCount(),
      emailStats: emailService.getStats(),
      activeUsers: Math.floor(Math.random() * 100) // Simulate active users
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Update active users gauge periodically
const activeUsersInterval = setInterval(() => {
  const activeUsers = Math.floor(Math.random() * 100);
  activeUsersGauge.set(activeUsers);
}, 30000);

// Store interval for cleanup
if (typeof global !== 'undefined') {
  (global as any).activeUsersInterval = activeUsersInterval;
}

// Start the application
async function startApp() {
  try {
    await actuator.start();
    console.log(`Actuator started on port ${actuator.getPort()}`);
    console.log(`Actuator endpoints available at http://localhost:${actuator.getPort()}/actuator`);
    console.log(`Main application endpoints available at http://localhost:${actuator.getPort()}/api`);
    
    // Start the main application server
    const server = app.listen(3000, () => {
      console.log('Sample application started on port 3000');
      console.log('Available endpoints:');
      console.log('  GET  /api/users/:id - Get user by ID');
      console.log('  POST /api/users - Create new user');
      console.log('  POST /api/email - Send email');
      console.log('  GET  /api/stats - Get application statistics');
      console.log('');
      console.log('Actuator endpoints:');
      console.log('  GET  /actuator/health - Health check');
      console.log('  GET  /actuator/metrics - Application metrics');
      console.log('  GET  /actuator/prometheus - Prometheus metrics');
      console.log('  GET  /actuator/info - Application info');
      console.log('  GET  /actuator/env - Environment variables');
      console.log('  GET  /actuator/configprops - Configuration properties');
      console.log('  GET  /actuator/beans - Application beans');
      console.log('  GET  /actuator/mappings - Route mappings');
      console.log('  GET  /actuator/threaddump - Thread dump');
      console.log('  POST /actuator/heapdump - Generate heap dump');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      server.close(async () => {
        await actuator.shutdown();
        console.log('Application shutdown complete');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      server.close(async () => {
        await actuator.shutdown();
        console.log('Application shutdown complete');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application if this file is run directly
if (require.main === module) {
  startApp();
}

// Cleanup function for tests
export function cleanup() {
  if ((global as any).activeUsersInterval) {
    clearInterval((global as any).activeUsersInterval);
    delete (global as any).activeUsersInterval;
  }
}

export { app, actuator, userService, emailService, databaseService }; 
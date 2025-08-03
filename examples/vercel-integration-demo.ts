import express from 'express';
import { ActuatorMiddleware, ActuatorMiddlewareOptions } from '../src/core/ActuatorMiddleware';

// Sample business logic classes (same as in sample-app.ts)
class UserService {
  private users = new Map<string, any>();
  private requestCount = 0;

  async getUser(id: string) {
    this.requestCount++;
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

  clearUsers() {
    this.users.clear();
    this.requestCount = 0;
  }
}

class EmailService {
  private sentEmails = 0;
  private failedEmails = 0;

  async sendEmail(to: string, subject: string, body: string) {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
    
    if (Math.random() < 0.1) {
      this.failedEmails++;
      throw new Error('Email service temporarily unavailable');
    }
    
    this.sentEmails++;
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

  resetStats() {
    this.sentEmails = 0;
    this.failedEmails = 0;
  }
}

class DatabaseService {
  private isConnected = true;
  private queryCount = 0;

  async query(sql: string, params: any[] = []) {
    this.queryCount++;
    
    if (Math.random() < 0.05) {
      this.isConnected = false;
      throw new Error('Database connection lost');
    }
    
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    
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

  resetConnection() {
    this.isConnected = true;
    this.queryCount = 0;
  }

  setConnectionState(connected: boolean) {
    this.isConnected = connected;
  }
}

// Initialize services
const userService = new UserService();
const emailService = new EmailService();
const databaseService = new DatabaseService();

// Configure actuator middleware (no port needed for serverless!)
const actuatorOptions: ActuatorMiddlewareOptions = {
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
  enableHeapDump: false, // Disable heap dump in serverless environment
  retryOptions: {
    maxRetries: 3,
    retryDelay: 100,
    exponentialBackoff: true
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
    'app.name': 'Vercel Integration Demo',
    'app.version': '1.0.0',
    'app.environment': process.env['NODE_ENV'] || 'development',
    'app.deployment': 'vercel',
    'database.host': process.env['DATABASE_HOST'] || 'localhost',
    'database.port': parseInt(process.env['DATABASE_PORT'] || '5432'),
    'email.provider': process.env['EMAIL_PROVIDER'] || 'smtp.example.com',
    'email.retryAttempts': 3,
    'user.maxAge': 86400,
    'feature.newUI': true,
    'feature.analytics': false
  },
  healthOptions: {
    includeDiskSpace: false, // Disable disk space check in serverless
    includeProcess: true,
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

// Create actuator middleware
const actuatorMiddleware = new ActuatorMiddleware(actuatorOptions);

// Get custom metrics
const userRequestsCounter = actuatorMiddleware.getCustomMetric('user_requests_total');
const emailSentCounter = actuatorMiddleware.getCustomMetric('email_sent_total');
const emailFailedCounter = actuatorMiddleware.getCustomMetric('email_failed_total');
const databaseQueriesCounter = actuatorMiddleware.getCustomMetric('database_queries_total');
const databaseResponseTime = actuatorMiddleware.getCustomMetric('database_response_time');
const activeUsersGauge = actuatorMiddleware.getCustomMetric('active_users');

// Create main application
const app = express();
app.use(express.json());

// Add actuator middleware to the main app
app.use(actuatorMiddleware.getRouter());

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
      activeUsers: Math.floor(Math.random() * 100)
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

// Start the application (for local development)
async function startApp() {
  try {
    const port = process.env.PORT || 3000;
    const server = app.listen(port, () => {
      console.log(`Vercel integration demo started on port ${port}`);
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
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      server.close(() => {
        console.log('Application shutdown complete');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      server.close(() => {
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

export { app, actuatorMiddleware, userService, emailService, databaseService }; 
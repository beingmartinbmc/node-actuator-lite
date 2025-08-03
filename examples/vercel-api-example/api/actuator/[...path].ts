import { NextApiRequest, NextApiResponse } from 'next';
import { ActuatorMiddleware, ActuatorMiddlewareOptions } from '../../../../src/core/ActuatorMiddleware';

// Sample services (in a real app, these would be imported from your business logic)
class DatabaseService {
  private isConnected = true;
  
  async healthCheck() {
    return {
      status: this.isConnected ? 'UP' : 'DOWN',
      details: {
        connected: this.isConnected,
        responseTime: Math.random() * 100
      }
    };
  }
}

class EmailService {
  private sentEmails = 0;
  private failedEmails = 0;

  async sendEmail(to: string, subject: string, body: string) {
    if (Math.random() < 0.1) {
      this.failedEmails++;
      throw new Error('Email service temporarily unavailable');
    }
    
    this.sentEmails++;
    return { 
      messageId: `msg_${Date.now()}`, 
      status: 'sent', 
      recipient: to
    };
  }

  getStats() {
    return { sent: this.sentEmails, failed: this.failedEmails };
  }
}

const databaseService = new DatabaseService();
const emailService = new EmailService();

// Configure actuator middleware for Vercel
const actuatorOptions: ActuatorMiddlewareOptions = {
  basePath: '/api/actuator',
  enableHealth: true,
  enableMetrics: true,
  enableInfo: true,
  enableEnv: true,
  enablePrometheus: true,
  enableMappings: true,
  enableBeans: true,
  enableConfigProps: true,
  enableThreadDump: true,
  enableHeapDump: false, // Disable heap dump in serverless
  customHealthChecks: [
    async () => {
      try {
        return await databaseService.healthCheck();
      } catch (error) {
        return { status: 'DOWN', details: { error: error instanceof Error ? error.message : 'Unknown error' } };
      }
    },
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
    { name: 'api_requests_total', help: 'Total number of API requests', type: 'counter' },
    { name: 'email_sent_total', help: 'Total number of emails sent', type: 'counter' },
    { name: 'email_failed_total', help: 'Total number of failed emails', type: 'counter' }
  ],
  customBeans: {
    'databaseService': { name: 'DatabaseService', type: 'service', instance: databaseService },
    'emailService': { name: 'EmailService', type: 'service', instance: emailService }
  },
  customConfigProps: {
    'app.name': 'Vercel API Example',
    'app.version': '1.0.0',
    'app.environment': process.env['NODE_ENV'] || 'development',
    'app.deployment': 'vercel',
    'database.host': process.env['DATABASE_HOST'] || 'localhost',
    'email.provider': process.env['EMAIL_PROVIDER'] || 'smtp.example.com'
  },
  healthOptions: {
    includeDiskSpace: false, // Disable disk space check in serverless
    includeProcess: true,
    healthCheckTimeout: 5000
  }
};

// Create actuator middleware
const actuatorMiddleware = new ActuatorMiddleware(actuatorOptions);

// Export the catch-all actuator endpoint handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const pathString = Array.isArray(path) ? path.join('/') : path || '';
  
  try {
    // Route to the appropriate actuator endpoint based on the path
    switch (pathString) {
      case 'health':
        await handleHealth(req, res);
        break;
      case 'metrics':
        await handleMetrics(req, res);
        break;
      case 'prometheus':
        await handlePrometheus(req, res);
        break;
      case 'info':
        await handleInfo(req, res);
        break;
      case 'env':
        await handleEnv(req, res);
        break;
      case 'threaddump':
        await handleThreadDump(req, res);
        break;
      case 'mappings':
        await handleMappings(req, res);
        break;
      case 'beans':
        await handleBeans(req, res);
        break;
      case 'configprops':
        await handleConfigProps(req, res);
        break;
      default:
        res.status(404).json({ error: 'Actuator endpoint not found', path: pathString });
    }
  } catch (error) {
    console.error('Actuator endpoint error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Health endpoint handler
async function handleHealth(req: NextApiRequest, res: NextApiResponse) {
  try {
    const health = await actuatorMiddleware.getHealthIndicators();
    res.status(200).json({
      status: 'UP',
      details: { checks: health },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'DOWN', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Metrics endpoint handler
async function handleMetrics(req: NextApiRequest, res: NextApiResponse) {
  try {
    // In a real implementation, you would call the metrics collector
    const metrics = {
      system: {
        cpu: {
          usage: Math.random() * 100,
          cores: require('os').cpus().length
        },
        memory: {
          total: require('os').totalmem(),
          free: require('os').freemem(),
          used: require('os').totalmem() - require('os').freemem()
        }
      },
      process: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };
    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Metrics collection failed'
    });
  }
}

// Prometheus endpoint handler
async function handlePrometheus(req: NextApiRequest, res: NextApiResponse) {
  try {
    // In a real implementation, you would return Prometheus metrics
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send('# Prometheus metrics would be here\n');
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Prometheus metrics failed'
    });
  }
}

// Info endpoint handler
async function handleInfo(req: NextApiRequest, res: NextApiResponse) {
  try {
    const info = {
      app: {
        name: 'Vercel API Example',
        version: '1.0.0',
        environment: process.env['NODE_ENV'] || 'development'
      },
      build: {
        artifact: 'vercel-deployment',
        version: process.env['VERCEL_GIT_COMMIT_SHA'] || 'unknown'
      }
    };
    res.status(200).json(info);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Info collection failed'
    });
  }
}

// Environment endpoint handler
async function handleEnv(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only return safe environment variables
    const safeEnv = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_REGION: process.env.VERCEL_REGION
    };
    res.status(200).json(safeEnv);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Environment info failed'
    });
  }
}

// Thread dump endpoint handler
async function handleThreadDump(req: NextApiRequest, res: NextApiResponse) {
  try {
    // In a real implementation, you would collect thread information
    const threadDump = {
      threads: [
        {
          name: 'main',
          state: 'RUNNABLE',
          stackTrace: []
        }
      ]
    };
    res.status(200).json(threadDump);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Thread dump failed'
    });
  }
}

// Mappings endpoint handler
async function handleMappings(req: NextApiRequest, res: NextApiResponse) {
  try {
    const mappings = {
      context: {
        mappings: {
          dispatcherServlets: {
            dispatcherServlet: [
              {
                handler: 'Health Check Endpoint',
                predicate: 'GET /api/actuator/health',
                details: {
                  requestMappingConditions: {
                    methods: ['GET'],
                    patterns: ['/api/actuator/health']
                  }
                }
              }
            ]
          }
        }
      }
    };
    res.status(200).json(mappings);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Mappings failed'
    });
  }
}

// Beans endpoint handler
async function handleBeans(req: NextApiRequest, res: NextApiResponse) {
  try {
    const beans = {
      context: {
        beans: {
          databaseService: {
            aliases: [],
            scope: 'singleton',
            type: 'DatabaseService',
            resource: 'class path resource',
            dependencies: []
          },
          emailService: {
            aliases: [],
            scope: 'singleton',
            type: 'EmailService',
            resource: 'class path resource',
            dependencies: []
          }
        }
      }
    };
    res.status(200).json(beans);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Beans failed'
    });
  }
}

// Config props endpoint handler
async function handleConfigProps(req: NextApiRequest, res: NextApiResponse) {
  try {
    const configProps = {
      contexts: {
        application: {
          beans: {
            'app.name': {
              prefix: 'app',
              properties: {
                'app.name': 'Vercel API Example',
                'app.version': '1.0.0',
                'app.environment': process.env['NODE_ENV'] || 'development'
              }
            }
          }
        }
      }
    };
    res.status(200).json(configProps);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Config props failed'
    });
  }
} 
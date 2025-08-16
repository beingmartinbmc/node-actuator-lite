import { NextApiRequest, NextApiResponse } from 'next';
import { HealthChecker } from '../../../../../src/health/HealthChecker';

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

// Create health checker with custom health checks
const healthChecker = new HealthChecker([
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
    },
    enabled: true,
    critical: false
  }
], {
  includeDiskSpace: false, // Disable disk space check in serverless
  includeProcess: true,
  healthCheckTimeout: 5000
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Perform health check
    const health = await healthChecker.check();
    
    // Build response
    const checks = [];
    const components: any = {};
    let anyCheckDown = false;
    
    if (health.details && health.details['checks']) {
      for (const check of health.details['checks']) {
        checks.push(check);
        components[check.name] = {
          status: check.status,
          details: check.details
        };
        if (check.status === 'DOWN') {
          anyCheckDown = true;
        }
      }
    }

    const transformedHealth: any = {
      status: health.status,
      details: { checks },
      components,
      timestamp: health.timestamp,
      uptime: health.uptime,
      deployment: 'vercel-serverless',
      function: 'actuator-serverless-health'
    };

    if (health.details && health.details['responseTime']) {
      transformedHealth.details.responseTime = health.details['responseTime'];
    }

    // Set appropriate status code
    if (health.status === 'DOWN' || anyCheckDown) {
      transformedHealth.status = 'DOWN';
      const firstDown = checks.find((c: any) => c.status === 'DOWN');
      if (firstDown && firstDown.details && firstDown.details.error) {
        transformedHealth.error = firstDown.details.error;
      } else {
        transformedHealth.error = 'One or more health checks failed';
      }
      res.status(500).json(transformedHealth);
    } else {
      res.status(200).json(transformedHealth);
    }
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'DOWN', 
      details: { checks: [] },
      components: {},
      error: error instanceof Error ? error.message : 'Unknown error',
      deployment: 'vercel-serverless',
      function: 'actuator-serverless-health'
    });
  }
} 
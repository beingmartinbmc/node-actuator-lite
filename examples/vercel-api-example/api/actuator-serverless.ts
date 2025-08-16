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

// Configure actuator middleware for Vercel (serverless-friendly - everything configured upfront!)
const actuatorOptions: ActuatorMiddlewareOptions = {
  basePath: '/api/actuator-serverless',
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
  // Serverless-friendly health checks configuration
  healthChecks: [
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
  ],
  // Serverless-friendly metrics configuration
  customMetrics: [
    { 
      name: 'api_requests_total', 
      help: 'Total number of API requests', 
      type: 'counter',
      labelNames: ['method', 'endpoint']
    },
    { 
      name: 'email_sent_total', 
      help: 'Total number of emails sent', 
      type: 'counter' 
    },
    { 
      name: 'email_failed_total', 
      help: 'Total number of failed emails', 
      type: 'counter' 
    }
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
  },
  // Serverless-friendly route registration
  routes: [
    { method: 'GET', path: '/api/actuator-serverless', handler: 'Root Endpoint' },
    { method: 'GET', path: '/api/actuator-serverless/health', handler: 'Health Check Endpoint' },
    { method: 'GET', path: '/api/actuator-serverless/metrics', handler: 'Metrics Endpoint' },
    { method: 'GET', path: '/api/actuator-serverless/prometheus', handler: 'Prometheus Endpoint' },
    { method: 'GET', path: '/api/actuator-serverless/info', handler: 'Info Endpoint' },
    { method: 'GET', path: '/api/actuator-serverless/env', handler: 'Environment Endpoint' },
    { method: 'GET', path: '/api/actuator-serverless/threaddump', handler: 'Thread Dump Endpoint' },
    { method: 'GET', path: '/api/actuator-serverless/mappings', handler: 'Mappings Endpoint' },
    { method: 'GET', path: '/api/actuator-serverless/beans', handler: 'Beans Endpoint' },
    { method: 'GET', path: '/api/actuator-serverless/configprops', handler: 'Config Props Endpoint' }
  ]
};

// Create actuator middleware (everything configured upfront - no runtime API calls needed!)
const actuatorMiddleware = new ActuatorMiddleware(actuatorOptions);

// Export the root actuator endpoint handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Return available endpoints
    const endpoints = {
      message: 'Node Actuator Lite - Serverless Endpoints',
      version: '1.1.1',
      availableEndpoints: [
        { path: '/api/actuator-serverless', method: 'GET', description: 'Root endpoint (this page)' },
        { path: '/api/actuator-serverless/health', method: 'GET', description: 'Health check' },
        { path: '/api/actuator-serverless/metrics', method: 'GET', description: 'Application metrics' },
        { path: '/api/actuator-serverless/prometheus', method: 'GET', description: 'Prometheus metrics' },
        { path: '/api/actuator-serverless/info', method: 'GET', description: 'Application info' },
        { path: '/api/actuator-serverless/env', method: 'GET', description: 'Environment variables' },
        { path: '/api/actuator-serverless/threaddump', method: 'GET', description: 'Thread dump' },
        { path: '/api/actuator-serverless/mappings', method: 'GET', description: 'Route mappings' },
        { path: '/api/actuator-serverless/beans', method: 'GET', description: 'Application beans' },
        { path: '/api/actuator-serverless/configprops', method: 'GET', description: 'Configuration properties' }
      ],
      documentation: 'https://github.com/beingmartinbmc/node-actuator-lite',
      deployment: 'vercel-serverless'
    };
    
    res.status(200).json(endpoints);
  } catch (error) {
    console.error('Actuator root endpoint error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 
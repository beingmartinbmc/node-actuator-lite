import { NextApiRequest, NextApiResponse } from 'next';
import { ActuatorMiddleware, ActuatorMiddlewareOptions } from '../../../src/core/ActuatorMiddleware';

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

const databaseService = new DatabaseService();

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
    }
  ],
  customBeans: {
    'databaseService': { name: 'DatabaseService', type: 'service', instance: databaseService }
  },
  customConfigProps: {
    'app.name': 'Vercel API Example',
    'app.version': '1.0.0',
    'app.environment': process.env['NODE_ENV'] || 'development',
    'app.deployment': 'vercel',
    'database.host': process.env['DATABASE_HOST'] || 'localhost'
  },
  healthOptions: {
    includeDiskSpace: false, // Disable disk space check in serverless
    includeProcess: true,
    healthCheckTimeout: 5000
  }
};

// Create actuator middleware
const actuatorMiddleware = new ActuatorMiddleware(actuatorOptions);

// Export the health endpoint handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Route the request to the appropriate actuator endpoint
  if (req.url?.startsWith('/api/actuator/health')) {
    // Handle health check specifically
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
  } else {
    // For other actuator endpoints, you would need to implement proper routing
    // This is a simplified example - in practice, you'd want to use a proper router
    res.status(404).json({ error: 'Endpoint not found' });
  }
} 
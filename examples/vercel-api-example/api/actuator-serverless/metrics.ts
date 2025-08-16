import { NextApiRequest, NextApiResponse } from 'next';
import { MetricsCollector } from '../../../../../src/metrics/MetricsCollector';

// Create metrics collector
const metricsCollector = new MetricsCollector();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Collect metrics
    const metrics = await metricsCollector.collect();
    
    // Add some custom metrics for demonstration
    const customMetrics = {
      ...metrics,
      custom: {
        serverless_function: {
          name: 'actuator-serverless-metrics',
          region: process.env.VERCEL_REGION || 'unknown',
          environment: process.env.NODE_ENV || 'development',
          timestamp: new Date().toISOString()
        },
        requests: {
          total: Math.floor(Math.random() * 1000),
          successful: Math.floor(Math.random() * 950),
          failed: Math.floor(Math.random() * 50)
        }
      }
    };

    res.status(200).json(customMetrics);
  } catch (error) {
    console.error('Metrics collection error:', error);
    res.status(500).json({ 
      error: 'Metrics collection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 
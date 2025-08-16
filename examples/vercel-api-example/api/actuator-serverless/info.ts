import { NextApiRequest, NextApiResponse } from 'next';
import { InfoCollector } from '../../../../../src/info/InfoCollector';

// Create info collector
const infoCollector = new InfoCollector();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Collect info
    const info = await infoCollector.collect();
    
    // Add Vercel-specific info
    const vercelInfo = {
      ...info,
      vercel: {
        region: process.env.VERCEL_REGION || 'unknown',
        environment: process.env.NODE_ENV || 'development',
        deployment: 'serverless',
        function: 'actuator-serverless-info',
        timestamp: new Date().toISOString()
      },
      app: {
        name: 'Node Actuator Lite - Vercel Serverless',
        version: '1.1.1',
        description: 'Spring Boot Actuator-like endpoints for Node.js on Vercel'
      }
    };

    res.status(200).json(vercelInfo);
  } catch (error) {
    console.error('Info collection error:', error);
    res.status(500).json({ 
      error: 'Info collection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 
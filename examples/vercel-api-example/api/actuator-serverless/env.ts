import { NextApiRequest, NextApiResponse } from 'next';
import { EnvironmentCollector } from '../../../../../src/env/EnvironmentCollector';

// Create environment collector
const envCollector = new EnvironmentCollector();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Collect environment info
    const env = await envCollector.collect();
    
    // Add Vercel-specific environment variables (only safe ones)
    const vercelEnv = {
      ...env,
      vercel: {
        VERCEL_REGION: process.env.VERCEL_REGION,
        VERCEL_ENV: process.env.VERCEL_ENV,
        NODE_ENV: process.env.NODE_ENV,
        // Add other safe Vercel environment variables
        VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
        VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
        VERCEL_GIT_REPO_SLUG: process.env.VERCEL_GIT_REPO_SLUG,
        VERCEL_GIT_REPO_OWNER: process.env.VERCEL_GIT_REPO_OWNER
      },
      deployment: {
        type: 'vercel-serverless',
        function: 'actuator-serverless-env',
        timestamp: new Date().toISOString()
      }
    };

    res.status(200).json(vercelEnv);
  } catch (error) {
    console.error('Environment collection error:', error);
    res.status(500).json({ 
      error: 'Environment collection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 
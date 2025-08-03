import os from 'os';

export interface EnvironmentData {
  timestamp: string;
  nodeEnv: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  processEnv: Record<string, string>;
  systemInfo: {
    hostname: string;
    platform: string;
    arch: string;
    cpus: number;
    totalMemory: number;
    freeMemory: number;
    uptime: number;
  };
}

export class EnvironmentCollector {
  public async collect(): Promise<EnvironmentData> {
    const systemInfo = this.collectSystemInfo();
    const processEnv = this.collectProcessEnv();

    return {
      timestamp: new Date().toISOString(),
      nodeEnv: process.env['NODE_ENV'] || 'development',
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      processEnv,
      systemInfo
    };
  }

  private collectSystemInfo(): EnvironmentData['systemInfo'] {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime()
    };
  }

  private collectProcessEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    
    // Filter out sensitive environment variables
    const sensitiveKeys = [
      'PASSWORD',
      'SECRET',
      'KEY',
      'TOKEN',
      'AUTH',
      'CREDENTIAL',
      'PRIVATE',
      'SIGNATURE'
    ];

    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        const isSensitive = sensitiveKeys.some(sensitiveKey => 
          key.toUpperCase().includes(sensitiveKey)
        );
        
        env[key] = isSensitive ? '[HIDDEN]' : value;
      }
    }

    return env;
  }

  public async getFormattedEnvironment(): Promise<Record<string, any>> {
    const env = await this.collect();
    
    return {
      timestamp: env.timestamp,
      nodeEnv: env.nodeEnv,
      platform: env.platform,
      arch: env.arch,
      nodeVersion: env.nodeVersion,
      systemInfo: {
        hostname: env.systemInfo.hostname,
        platform: env.systemInfo.platform,
        arch: env.systemInfo.arch,
        cpus: env.systemInfo.cpus,
        totalMemory: `${(env.systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        freeMemory: `${(env.systemInfo.freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        uptime: `${env.systemInfo.uptime.toFixed(2)}s`
      },
      processEnv: env.processEnv
    };
  }

  public getEnvironmentVariable(key: string): string | undefined {
    return process.env[key];
  }

  public hasEnvironmentVariable(key: string): boolean {
    return key in process.env;
  }

  public getEnvironmentVariablesByPrefix(prefix: string): Record<string, string> {
    const env: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && key.startsWith(prefix)) {
        env[key] = value;
      }
    }
    
    return env;
  }
} 
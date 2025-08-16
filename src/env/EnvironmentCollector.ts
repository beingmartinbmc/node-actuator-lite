import os from 'os';

export interface EnvironmentData {
  timestamp: string;
  nodeEnv: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  processEnv: Record<string, string>;
  environment: Record<string, string>;
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

export interface EnvironmentCollectorOptions {
  maskPatterns?: string[];           // Patterns to match for masking (e.g., ['PASSWORD', 'SECRET'])
  maskCustomVariables?: string[];    // Specific variable names to mask
  maskValue?: string;                // Value to show instead of actual value (default: '[HIDDEN]')
  showMaskedCount?: boolean;         // Show count of masked variables
}

export class EnvironmentCollector {
  private options: EnvironmentCollectorOptions;

  constructor(options: EnvironmentCollectorOptions = {}) {
    this.options = {
      maskPatterns: [
        'PASSWORD',
        'SECRET',
        'KEY',
        'TOKEN',
        'AUTH',
        'CREDENTIAL',
        'PRIVATE',
        'SIGNATURE',
        'API_KEY',
        'DATABASE_URL',
        'REDIS_URL',
        'MONGODB_URI',
        'JWT_SECRET',
        'SESSION_SECRET'
      ],
      maskCustomVariables: [],
      maskValue: '[HIDDEN]',
      showMaskedCount: true,
      ...options
    };
  }

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
      environment: processEnv,
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
    let maskedCount = 0;
    
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        const shouldMask = this.shouldMaskVariable(key);
        
        if (shouldMask) {
          env[key] = this.options.maskValue!;
          maskedCount++;
        } else {
          env[key] = value;
        }
      }
    }

    // Add masked count information if enabled
    if (this.options.showMaskedCount) {
      env['_MASKED_VARIABLES_COUNT'] = maskedCount.toString();
      env['_MASKED_PATTERNS'] = this.options.maskPatterns!.join(', ');
      if (this.options.maskCustomVariables!.length > 0) {
        env['_MASKED_CUSTOM_VARIABLES'] = this.options.maskCustomVariables!.join(', ');
      }
    }

    return env;
  }

  private shouldMaskVariable(key: string): boolean {
    const upperKey = key.toUpperCase();
    
    // Check custom variables first
    if (this.options.maskCustomVariables!.includes(key)) {
      return true;
    }
    
    // Check patterns
    return this.options.maskPatterns!.some(pattern => 
      upperKey.includes(pattern.toUpperCase())
    );
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

  // Utility methods for environment variable management
  public addMaskPattern(pattern: string): void {
    if (!this.options.maskPatterns!.includes(pattern)) {
      this.options.maskPatterns!.push(pattern);
    }
  }

  public addCustomMaskVariable(variable: string): void {
    if (!this.options.maskCustomVariables!.includes(variable)) {
      this.options.maskCustomVariables!.push(variable);
    }
  }

  public removeMaskPattern(pattern: string): void {
    this.options.maskPatterns = this.options.maskPatterns!.filter(p => p !== pattern);
  }

  public removeCustomMaskVariable(variable: string): void {
    this.options.maskCustomVariables = this.options.maskCustomVariables!.filter(v => v !== variable);
  }

  public getMaskPatterns(): string[] {
    return [...this.options.maskPatterns!];
  }

  public getCustomMaskVariables(): string[] {
    return [...this.options.maskCustomVariables!];
  }

  public setMaskValue(value: string): void {
    this.options.maskValue = value;
  }

  public getMaskValue(): string {
    return this.options.maskValue!;
  }
} 
import os from 'os';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface AppInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  repository?: string;
  homepage?: string;
  bugs?: string;
}

export interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  npmVersion: string | undefined;
  uptime: number;
  startTime: string;
}

export interface InfoData {
  app: AppInfo;
  system: SystemInfo;
  timestamp: string;
}

export class InfoCollector {
  private packageJson: any;

  constructor() {
    try {
      const packagePath = join(process.cwd(), 'package.json');
      this.packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    } catch (error) {
      this.packageJson = {
        name: 'unknown',
        version: '0.0.0',
        description: 'No description available',
        author: 'Unknown',
        license: 'Unknown'
      };
    }
  }

  public async collect(): Promise<InfoData> {
    const appInfo = this.collectAppInfo();
    const systemInfo = await this.collectSystemInfo();

    return {
      app: appInfo,
      system: systemInfo,
      timestamp: new Date().toISOString()
    };
  }

  private collectAppInfo(): AppInfo {
    return {
      name: this.packageJson.name || 'unknown',
      version: this.packageJson.version || '0.0.0',
      description: this.packageJson.description || 'No description available',
      author: this.packageJson.author || 'Unknown',
      license: this.packageJson.license || 'Unknown',
      repository: this.packageJson.repository?.url || this.packageJson.repository,
      homepage: this.packageJson.homepage,
      bugs: this.packageJson.bugs?.url || this.packageJson.bugs
    };
  }

  private async collectSystemInfo(): Promise<SystemInfo> {
    let npmVersion: string | undefined;
    
    try {
      // Try to get npm version
      const { execSync } = require('child_process');
      npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    } catch (error) {
      npmVersion = undefined;
    }

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      npmVersion,
      uptime: process.uptime(),
      startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
    };
  }

  public async getFormattedInfo(): Promise<Record<string, any>> {
    const info = await this.collect();
    
    return {
      timestamp: info.timestamp,
      app: {
        name: info.app.name,
        version: info.app.version,
        description: info.app.description,
        author: info.app.author,
        license: info.app.license,
        repository: info.app.repository,
        homepage: info.app.homepage,
        bugs: info.app.bugs
      },
      system: {
        hostname: info.system.hostname,
        platform: info.system.platform,
        arch: info.system.arch,
        nodeVersion: info.system.nodeVersion,
        npmVersion: info.system.npmVersion,
        uptime: `${info.system.uptime.toFixed(2)}s`,
        startTime: info.system.startTime
      }
    };
  }
} 
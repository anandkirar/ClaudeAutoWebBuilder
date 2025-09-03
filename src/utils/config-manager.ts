import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import { FrameworkConfig } from '../types';

export class ConfigManager {
  private defaultConfig: FrameworkConfig = {
    aiProvider: 'openai',
    apiKeys: {},
    database: {
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'autonomous_framework',
      username: 'postgres',
      password: 'password'
    },
    deployment: {
      provider: 'docker',
      environment: 'development',
      autoScale: false,
      healthChecks: true,
      rollbackOnFailure: true
    },
    monitoring: {
      enableRealTime: true,
      errorTracking: true,
      performanceMetrics: true,
      userAnalytics: false,
      alertWebhooks: []
    },
    testing: {
      unitTests: true,
      integrationTests: true,
      e2eTests: false,
      visualRegression: false,
      performanceTesting: false,
      accessibility: true,
      autoFix: true
    },
    healing: {
      autoFix: true,
      retryAttempts: 3,
      rollbackThreshold: 2,
      learningMode: true,
      notifyOnFix: true
    },
    workspaceDir: path.join(process.cwd(), 'workspace'),
    logLevel: 'info'
  };

  mergeConfig(userConfig: Partial<FrameworkConfig> = {}): FrameworkConfig {
    const envConfig = this.loadFromEnvironment();
    const fileConfig = this.loadFromFile();
    
    return this.deepMerge(
      this.defaultConfig,
      fileConfig,
      envConfig,
      userConfig
    ) as FrameworkConfig;
  }

  private loadFromEnvironment(): Partial<FrameworkConfig> {
    const config: Partial<FrameworkConfig> = {};

    if (process.env.FRAMEWORK_AI_PROVIDER) {
      config.aiProvider = process.env.FRAMEWORK_AI_PROVIDER as any;
    }

    if (process.env.OPENAI_API_KEY) {
      config.apiKeys = { ...config.apiKeys, openai: process.env.OPENAI_API_KEY };
    }

    if (process.env.ANTHROPIC_API_KEY) {
      config.apiKeys = { ...config.apiKeys, anthropic: process.env.ANTHROPIC_API_KEY };
    }

    if (process.env.FRAMEWORK_WORKSPACE_DIR) {
      config.workspaceDir = process.env.FRAMEWORK_WORKSPACE_DIR;
    }

    if (process.env.FRAMEWORK_LOG_LEVEL) {
      config.logLevel = process.env.FRAMEWORK_LOG_LEVEL as any;
    }

    if (process.env.DATABASE_URL) {
      config.database = { ...config.database, url: process.env.DATABASE_URL };
    }

    if (process.env.DATABASE_TYPE) {
      config.database = { ...config.database, type: process.env.DATABASE_TYPE as any };
    }

    return config;
  }

  private loadFromFile(): Partial<FrameworkConfig> {
    const configFiles = [
      'framework.config.js',
      'framework.config.json',
      'framework.config.yml',
      'framework.config.yaml'
    ];

    for (const configFile of configFiles) {
      const configPath = path.join(process.cwd(), configFile);
      
      if (fs.existsSync(configPath)) {
        try {
          return this.parseConfigFile(configPath);
        } catch (error) {
          console.warn(`Warning: Failed to parse config file ${configFile}:`, error.message);
        }
      }
    }

    return {};
  }

  private parseConfigFile(configPath: string): Partial<FrameworkConfig> {
    const ext = path.extname(configPath).toLowerCase();
    const content = fs.readFileSync(configPath, 'utf8');

    switch (ext) {
      case '.json':
        return JSON.parse(content);
      case '.yml':
      case '.yaml':
        return yaml.parse(content);
      case '.js':
        delete require.cache[require.resolve(configPath)];
        return require(configPath);
      default:
        throw new Error(`Unsupported config file format: ${ext}`);
    }
  }

  async saveConfig(config: FrameworkConfig, format: 'json' | 'yaml' = 'json'): Promise<void> {
    const configPath = path.join(process.cwd(), `framework.config.${format}`);
    
    let content: string;
    if (format === 'json') {
      content = JSON.stringify(config, null, 2);
    } else {
      content = yaml.stringify(config, { indent: 2 });
    }

    await fs.writeFile(configPath, content, 'utf8');
  }

  validateConfig(config: FrameworkConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.aiProvider) {
      errors.push('AI provider is required');
    }

    if (!config.apiKeys[config.aiProvider]) {
      errors.push(`API key for ${config.aiProvider} is required`);
    }

    if (!config.workspaceDir) {
      errors.push('Workspace directory is required');
    }

    if (!fs.existsSync(path.dirname(config.workspaceDir))) {
      errors.push(`Workspace directory parent does not exist: ${path.dirname(config.workspaceDir)}`);
    }

    if (config.database.type === 'postgresql' && !config.database.url && 
        (!config.database.host || !config.database.database)) {
      errors.push('PostgreSQL database configuration is incomplete');
    }

    if (config.database.type === 'mongodb' && !config.database.url) {
      errors.push('MongoDB connection URL is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private deepMerge(...objects: any[]): any {
    const result = {};
    
    for (const obj of objects) {
      if (!obj) continue;
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (
            typeof obj[key] === 'object' && 
            obj[key] !== null && 
            !Array.isArray(obj[key]) &&
            typeof result[key] === 'object' && 
            result[key] !== null && 
            !Array.isArray(result[key])
          ) {
            result[key] = this.deepMerge(result[key], obj[key]);
          } else {
            result[key] = obj[key];
          }
        }
      }
    }
    
    return result;
  }

  generateSampleConfig(): FrameworkConfig {
    return {
      ...this.defaultConfig,
      apiKeys: {
        openai: 'your-openai-api-key-here',
        anthropic: 'your-anthropic-api-key-here'
      },
      database: {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'your_app_db',
        username: 'your_username',
        password: 'your_password'
      }
    };
  }
}
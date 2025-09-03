import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs-extra';
import { Logger } from './utils/logger';
import { RequirementsAnalyzer } from './core/requirements-analyzer';
import { AppGenerator } from './generators/app-generator';
import { TestingEngine } from './testing/testing-engine';
import { HealingSystem } from './healing/healing-system';
import { MonitoringSystem } from './monitoring/monitoring-system';
import { DeploymentManager } from './deployment/deployment-manager';
import { Dashboard } from './core/dashboard';
import { ConfigManager } from './utils/config-manager';
import {
  FrameworkConfig,
  RequirementSpec,
  GeneratedApp,
  FrameworkEvents,
  AppStatus,
  ErrorInfo,
  Fix
} from './types';

export class AutonomousWebFramework extends EventEmitter {
  private logger: Logger;
  private config: FrameworkConfig;
  private requirementsAnalyzer: RequirementsAnalyzer;
  private appGenerator: AppGenerator;
  private testingEngine: TestingEngine;
  private healingSystem: HealingSystem;
  private monitoringSystem: MonitoringSystem;
  private deploymentManager: DeploymentManager;
  private dashboard: Dashboard;
  private configManager: ConfigManager;
  private apps: Map<string, GeneratedApp> = new Map();
  private isRunning = false;

  constructor(config: Partial<FrameworkConfig> = {}) {
    super();
    
    this.configManager = new ConfigManager();
    this.config = this.configManager.mergeConfig(config);
    this.logger = new Logger(this.config.logLevel);
    
    this.initializeComponents();
    this.setupEventHandlers();
  }

  private initializeComponents(): void {
    this.logger.info('Initializing Autonomous Web Framework components...');
    
    try {
      this.requirementsAnalyzer = new RequirementsAnalyzer(this.config, this.logger);
      this.appGenerator = new AppGenerator(this.config, this.logger);
      this.testingEngine = new TestingEngine(this.config, this.logger);
      this.healingSystem = new HealingSystem(this.config, this.logger);
      this.monitoringSystem = new MonitoringSystem(this.config, this.logger);
      this.deploymentManager = new DeploymentManager(this.config, this.logger);
      this.dashboard = new Dashboard(this.config, this.logger);
      
      this.logger.info('All components initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize components:', error);
      throw new Error('Framework initialization failed');
    }
  }

  private setupEventHandlers(): void {
    this.on('app:created', this.handleAppCreated.bind(this));
    this.on('app:error', this.handleAppError.bind(this));
    this.on('app:fixed', this.handleAppFixed.bind(this));
    this.on('test:completed', this.handleTestCompleted.bind(this));
    this.on('monitoring:alert', this.handleMonitoringAlert.bind(this));
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Framework is already running');
      return;
    }

    this.logger.info('Starting Autonomous Web Framework...');
    
    try {
      await this.validateConfig();
      await this.createWorkspace();
      
      await this.monitoringSystem.start();
      await this.healingSystem.start();
      await this.dashboard.start();
      
      this.isRunning = true;
      this.logger.info('Framework started successfully');
      
      this.emit('framework:started');
    } catch (error) {
      this.logger.error('Failed to start framework:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Framework is not running');
      return;
    }

    this.logger.info('Stopping Autonomous Web Framework...');
    
    try {
      await this.dashboard.stop();
      await this.healingSystem.stop();
      await this.monitoringSystem.stop();
      
      this.isRunning = false;
      this.logger.info('Framework stopped successfully');
      
      this.emit('framework:stopped');
    } catch (error) {
      this.logger.error('Error stopping framework:', error);
      throw error;
    }
  }

  async createApp(requirements: string): Promise<GeneratedApp> {
    this.logger.info(`Creating new app from requirements: ${requirements.substring(0, 100)}...`);
    
    try {
      const spec = await this.requirementsAnalyzer.analyze(requirements);
      this.logger.info(`Requirements analyzed. Generating app: ${spec.title}`);
      
      const app = await this.appGenerator.generate(spec);
      this.apps.set(app.id, app);
      
      this.emit('app:created', { app });
      
      await this.runTests(app.id);
      
      return app;
    } catch (error) {
      this.logger.error('Failed to create app:', error);
      throw error;
    }
  }

  async runTests(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App with ID ${appId} not found`);
    }

    this.logger.info(`Running tests for app: ${app.name}`);
    
    try {
      const testSuites = await this.testingEngine.runAllTests(app);
      
      const hasFailures = testSuites.some(suite => suite.status === 'failed');
      if (hasFailures && this.config.healing.autoFix) {
        this.logger.info(`Test failures detected. Starting healing process...`);
        await this.healingSystem.healApp(app);
      }
      
      this.emit('test:completed', { app, suites: testSuites });
    } catch (error) {
      this.logger.error(`Test execution failed for app ${app.name}:`, error);
      throw error;
    }
  }

  async deployApp(appId: string, environment: 'development' | 'staging' | 'production' = 'development'): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App with ID ${appId} not found`);
    }

    this.logger.info(`Deploying app: ${app.name} to ${environment}`);
    
    try {
      if (this.config.testing.unitTests || this.config.testing.integrationTests) {
        await this.runTests(appId);
      }
      
      const deployment = await this.deploymentManager.deploy(app, environment);
      
      if (deployment.status === 'success' && this.config.monitoring.enableRealTime) {
        await this.monitoringSystem.startMonitoring(app);
      }
      
      this.emit('app:deployed', { app, deployment });
    } catch (error) {
      this.logger.error(`Deployment failed for app ${app.name}:`, error);
      throw error;
    }
  }

  async getApp(appId: string): Promise<GeneratedApp | undefined> {
    return this.apps.get(appId);
  }

  async listApps(): Promise<GeneratedApp[]> {
    return Array.from(this.apps.values());
  }

  async deleteApp(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App with ID ${appId} not found`);
    }

    this.logger.info(`Deleting app: ${app.name}`);
    
    try {
      await this.monitoringSystem.stopMonitoring(appId);
      
      const appDir = path.join(this.config.workspaceDir, 'apps', app.id);
      await fs.remove(appDir);
      
      this.apps.delete(appId);
      this.logger.info(`App ${app.name} deleted successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete app ${app.name}:`, error);
      throw error;
    }
  }

  private async validateConfig(): Promise<void> {
    this.logger.debug('Validating configuration...');
    
    if (!this.config.aiProvider || !this.config.apiKeys[this.config.aiProvider]) {
      throw new Error(`AI provider ${this.config.aiProvider} requires API key`);
    }
    
    if (!this.config.workspaceDir) {
      throw new Error('Workspace directory is required');
    }
    
    this.logger.debug('Configuration validated successfully');
  }

  private async createWorkspace(): Promise<void> {
    const workspaceDir = this.config.workspaceDir;
    
    try {
      await fs.ensureDir(workspaceDir);
      await fs.ensureDir(path.join(workspaceDir, 'apps'));
      await fs.ensureDir(path.join(workspaceDir, 'templates'));
      await fs.ensureDir(path.join(workspaceDir, 'backups'));
      await fs.ensureDir(path.join(workspaceDir, 'logs'));
      
      this.logger.info(`Workspace created at: ${workspaceDir}`);
    } catch (error) {
      this.logger.error('Failed to create workspace:', error);
      throw error;
    }
  }

  private async handleAppCreated({ app }: { app: GeneratedApp }): Promise<void> {
    this.logger.info(`App created: ${app.name} (${app.id})`);
    
    if (this.config.monitoring.enableRealTime) {
      await this.monitoringSystem.registerApp(app);
    }
  }

  private async handleAppError({ app, error }: { app: GeneratedApp; error: ErrorInfo }): Promise<void> {
    this.logger.error(`App error detected: ${app.name} - ${error.message}`);
    
    if (this.config.healing.autoFix && error.severity !== 'low') {
      this.logger.info(`Auto-healing enabled. Attempting to fix error: ${error.id}`);
      
      try {
        const fix = await this.healingSystem.fixError(app, error);
        if (fix) {
          this.emit('app:fixed', { app, fix });
        }
      } catch (healingError) {
        this.logger.error(`Healing failed for error ${error.id}:`, healingError);
      }
    }
  }

  private async handleAppFixed({ app, fix }: { app: GeneratedApp; fix: Fix }): Promise<void> {
    this.logger.info(`App fixed: ${app.name} - ${fix.description}`);
    
    if (fix.tested && this.config.testing.unitTests) {
      await this.runTests(app.id);
    }
  }

  private async handleTestCompleted({ app, suites }: { app: GeneratedApp; suites: any[] }): Promise<void> {
    const passedSuites = suites.filter(s => s.status === 'passed').length;
    const totalSuites = suites.length;
    
    this.logger.info(`Tests completed for ${app.name}: ${passedSuites}/${totalSuites} suites passed`);
    
    if (passedSuites === totalSuites && this.config.deployment.autoScale) {
      this.logger.info(`All tests passed. Auto-deploying ${app.name} to staging...`);
      try {
        await this.deployApp(app.id, 'staging');
      } catch (error) {
        this.logger.error('Auto-deployment failed:', error);
      }
    }
  }

  private async handleMonitoringAlert({ app, alert }: { app: GeneratedApp; alert: any }): Promise<void> {
    this.logger.warn(`Monitoring alert for ${app.name}: ${alert.message}`);
    
    if (alert.severity === 'critical' && this.config.healing.autoFix) {
      this.logger.info(`Critical alert detected. Initiating emergency healing...`);
      await this.healingSystem.emergencyHeal(app, alert);
    }
  }
}

export default AutonomousWebFramework;
export * from './types';
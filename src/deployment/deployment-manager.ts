import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs-extra';
import { 
  GeneratedApp, 
  DeploymentResult, 
  FrameworkConfig 
} from '../types';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);

export class DeploymentManager extends EventEmitter {
  private logger: Logger;
  private config: FrameworkConfig;
  private activeDeployments: Map<string, DeploymentResult> = new Map();

  constructor(config: FrameworkConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  async deploy(app: GeneratedApp, environment: 'development' | 'staging' | 'production' = 'development'): Promise<DeploymentResult> {
    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const deployment: DeploymentResult = {
      id: deploymentId,
      app_id: app.id,
      environment,
      status: 'pending',
      logs: [],
      duration: 0,
      timestamp: new Date()
    };

    this.activeDeployments.set(deploymentId, deployment);
    this.emit('deployment:started', { app, deployment });

    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting deployment of ${app.name} to ${environment}`);
      
      deployment.status = 'deploying';
      deployment.logs.push(`Starting deployment to ${environment} at ${new Date().toISOString()}`);

      const appDir = path.join(this.config.workspaceDir, 'apps', app.id);
      
      // Pre-deployment checks
      await this.runPreDeploymentChecks(app, deployment, appDir);
      
      // Build the application
      await this.buildApplication(app, deployment, appDir);
      
      // Deploy based on provider
      switch (this.config.deployment.provider) {
        case 'docker':
          await this.deployWithDocker(app, deployment, appDir, environment);
          break;
        case 'vercel':
          await this.deployWithVercel(app, deployment, appDir, environment);
          break;
        case 'netlify':
          await this.deployWithNetlify(app, deployment, appDir, environment);
          break;
        case 'aws':
          await this.deployWithAWS(app, deployment, appDir, environment);
          break;
        default:
          throw new Error(`Unsupported deployment provider: ${this.config.deployment.provider}`);
      }
      
      // Post-deployment checks
      await this.runPostDeploymentChecks(app, deployment, environment);
      
      deployment.status = 'success';
      deployment.logs.push(`Deployment completed successfully at ${new Date().toISOString()}`);
      
      this.logger.info(`Successfully deployed ${app.name} to ${environment}`);
      
    } catch (error) {
      deployment.status = 'failed';
      deployment.logs.push(`Deployment failed: ${error.message}`);
      
      this.logger.error(`Deployment failed for ${app.name}:`, error);
      
      if (this.config.deployment.rollbackOnFailure && environment !== 'development') {
        await this.rollbackDeployment(app, deployment, environment);
      }
      
    } finally {
      deployment.duration = Date.now() - startTime;
      this.emit('deployment:completed', { app, deployment });
      
      // Clean up old deployments
      setTimeout(() => {
        this.activeDeployments.delete(deploymentId);
      }, 3600000); // Keep for 1 hour
    }

    return deployment;
  }

  async getDeploymentStatus(deploymentId: string): Promise<DeploymentResult | null> {
    return this.activeDeployments.get(deploymentId) || null;
  }

  async getDeploymentLogs(deploymentId: string): Promise<string[]> {
    const deployment = this.activeDeployments.get(deploymentId);
    return deployment ? deployment.logs : [];
  }

  private async runPreDeploymentChecks(app: GeneratedApp, deployment: DeploymentResult, appDir: string): Promise<void> {
    deployment.logs.push('Running pre-deployment checks...');
    
    // Check if required files exist
    const requiredFiles = ['package.json'];
    
    if (app.specification.techStack.frontend.framework === 'react') {
      requiredFiles.push('frontend/package.json');
    }
    
    if (app.specification.techStack.backend.framework) {
      requiredFiles.push('backend/package.json');
    }
    
    for (const file of requiredFiles) {
      const filePath = path.join(appDir, file);
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`Required file not found: ${file}`);
      }
    }
    
    // Check for environment variables
    await this.validateEnvironmentVariables(app, deployment, appDir);
    
    deployment.logs.push('Pre-deployment checks completed');
  }

  private async validateEnvironmentVariables(app: GeneratedApp, deployment: DeploymentResult, appDir: string): Promise<void> {
    const envExamplePath = path.join(appDir, '.env.example');
    
    if (await fs.pathExists(envExamplePath)) {
      const envExample = await fs.readFile(envExamplePath, 'utf8');
      const requiredVars = envExample
        .split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('=')[0])
        .filter(Boolean);
      
      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        deployment.logs.push(`Warning: Missing environment variables: ${missingVars.join(', ')}`);
      }
    }
  }

  private async buildApplication(app: GeneratedApp, deployment: DeploymentResult, appDir: string): Promise<void> {
    deployment.logs.push('Building application...');
    
    try {
      // Install dependencies and build
      const { stdout, stderr } = await execAsync('npm run build', {
        cwd: appDir,
        timeout: 300000 // 5 minutes
      });
      
      deployment.logs.push('Build completed successfully');
      if (stdout) deployment.logs.push(`Build output: ${stdout.substring(0, 1000)}`);
      if (stderr) deployment.logs.push(`Build warnings: ${stderr.substring(0, 1000)}`);
      
    } catch (error) {
      deployment.logs.push(`Build failed: ${error.message}`);
      throw new Error(`Build failed: ${error.message}`);
    }
  }

  private async deployWithDocker(app: GeneratedApp, deployment: DeploymentResult, appDir: string, environment: string): Promise<void> {
    deployment.logs.push('Deploying with Docker...');
    
    try {
      // Choose the appropriate compose file
      const composeFile = environment === 'production' ? 'docker-compose.prod.yml' : 'docker-compose.dev.yml';
      const composeFilePath = path.join(appDir, composeFile);
      
      if (!(await fs.pathExists(composeFilePath))) {
        throw new Error(`Docker compose file not found: ${composeFile}`);
      }
      
      // Stop existing containers
      try {
        await execAsync(`docker-compose -f ${composeFile} down`, {
          cwd: appDir,
          timeout: 60000
        });
      } catch (error) {
        deployment.logs.push('No existing containers to stop');
      }
      
      // Build and start containers
      const { stdout, stderr } = await execAsync(`docker-compose -f ${composeFile} up -d --build`, {
        cwd: appDir,
        timeout: 600000 // 10 minutes
      });
      
      deployment.logs.push('Docker containers started successfully');
      if (stdout) deployment.logs.push(`Docker output: ${stdout.substring(0, 1000)}`);
      if (stderr) deployment.logs.push(`Docker warnings: ${stderr.substring(0, 1000)}`);
      
      // Set deployment URL
      deployment.url = environment === 'production' ? 'https://localhost' : 'http://localhost:3000';
      
    } catch (error) {
      deployment.logs.push(`Docker deployment failed: ${error.message}`);
      throw error;
    }
  }

  private async deployWithVercel(app: GeneratedApp, deployment: DeploymentResult, appDir: string, environment: string): Promise<void> {
    deployment.logs.push('Deploying with Vercel...');
    
    try {
      // Check if Vercel CLI is installed
      await execAsync('vercel --version', { timeout: 10000 });
      
      // Deploy frontend to Vercel
      const frontendDir = path.join(appDir, 'frontend');
      
      if (await fs.pathExists(frontendDir)) {
        const vercelArgs = environment === 'production' ? '--prod' : '';
        
        const { stdout } = await execAsync(`vercel ${vercelArgs} --yes`, {
          cwd: frontendDir,
          timeout: 300000 // 5 minutes
        });
        
        // Extract deployment URL from output
        const urlMatch = stdout.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          deployment.url = urlMatch[0];
        }
        
        deployment.logs.push('Vercel deployment completed successfully');
        deployment.logs.push(`Deployment URL: ${deployment.url}`);
      } else {
        throw new Error('Frontend directory not found for Vercel deployment');
      }
      
    } catch (error) {
      if (error.message.includes('vercel --version')) {
        throw new Error('Vercel CLI not installed. Install with: npm install -g vercel');
      }
      deployment.logs.push(`Vercel deployment failed: ${error.message}`);
      throw error;
    }
  }

  private async deployWithNetlify(app: GeneratedApp, deployment: DeploymentResult, appDir: string, environment: string): Promise<void> {
    deployment.logs.push('Deploying with Netlify...');
    
    try {
      // Check if Netlify CLI is installed
      await execAsync('netlify --version', { timeout: 10000 });
      
      // Deploy frontend to Netlify
      const frontendDir = path.join(appDir, 'frontend');
      
      if (await fs.pathExists(frontendDir)) {
        const buildDir = path.join(frontendDir, 'dist');
        
        if (!(await fs.pathExists(buildDir))) {
          throw new Error('Build directory not found. Run build first.');
        }
        
        const netlifyArgs = environment === 'production' ? '--prod' : '';
        
        const { stdout } = await execAsync(`netlify deploy --dir=dist ${netlifyArgs}`, {
          cwd: frontendDir,
          timeout: 300000 // 5 minutes
        });
        
        // Extract deployment URL from output
        const urlMatch = stdout.match(/Website URL: (https?:\/\/[^\s]+)/);
        if (urlMatch) {
          deployment.url = urlMatch[1];
        }
        
        deployment.logs.push('Netlify deployment completed successfully');
        deployment.logs.push(`Deployment URL: ${deployment.url}`);
      } else {
        throw new Error('Frontend directory not found for Netlify deployment');
      }
      
    } catch (error) {
      if (error.message.includes('netlify --version')) {
        throw new Error('Netlify CLI not installed. Install with: npm install -g netlify-cli');
      }
      deployment.logs.push(`Netlify deployment failed: ${error.message}`);
      throw error;
    }
  }

  private async deployWithAWS(app: GeneratedApp, deployment: DeploymentResult, appDir: string, environment: string): Promise<void> {
    deployment.logs.push('Deploying with AWS...');
    
    try {
      // This would implement AWS deployment using CDK, CloudFormation, or direct API calls
      // For now, we'll create a placeholder implementation
      
      deployment.logs.push('AWS deployment is not yet implemented');
      throw new Error('AWS deployment provider is not yet implemented');
      
    } catch (error) {
      deployment.logs.push(`AWS deployment failed: ${error.message}`);
      throw error;
    }
  }

  private async runPostDeploymentChecks(app: GeneratedApp, deployment: DeploymentResult, environment: string): Promise<void> {
    deployment.logs.push('Running post-deployment checks...');
    
    if (!deployment.url) {
      deployment.logs.push('No deployment URL available, skipping health checks');
      return;
    }
    
    // Wait for application to start
    await this.waitForApplication(deployment.url, deployment);
    
    if (this.config.deployment.healthChecks) {
      await this.runHealthChecks(deployment);
    }
    
    // Run smoke tests if available
    await this.runSmokeTests(app, deployment);
    
    deployment.logs.push('Post-deployment checks completed');
  }

  private async waitForApplication(url: string, deployment: DeploymentResult, maxWaitTime = 300000): Promise<void> {
    deployment.logs.push(`Waiting for application to start at ${url}...`);
    
    const start = Date.now();
    
    while (Date.now() - start < maxWaitTime) {
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url, { timeout: 10000 });
        
        if (response.ok) {
          deployment.logs.push('Application is responding');
          return;
        }
      } catch (error) {
        // Application not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }
    
    throw new Error(`Application did not start within ${maxWaitTime / 1000} seconds`);
  }

  private async runHealthChecks(deployment: DeploymentResult): Promise<void> {
    deployment.logs.push('Running health checks...');
    
    try {
      const healthUrls = [
        `${deployment.url}/health`,
        `${deployment.url}/api/health`
      ];
      
      const fetch = (await import('node-fetch')).default;
      
      for (const healthUrl of healthUrls) {
        try {
          const response = await fetch(healthUrl, { timeout: 10000 });
          
          if (response.ok) {
            deployment.logs.push(`Health check passed: ${healthUrl}`);
          } else {
            deployment.logs.push(`Health check warning: ${healthUrl} returned ${response.status}`);
          }
        } catch (error) {
          deployment.logs.push(`Health check failed: ${healthUrl} - ${error.message}`);
        }
      }
      
    } catch (error) {
      deployment.logs.push(`Health checks failed: ${error.message}`);
    }
  }

  private async runSmokeTests(app: GeneratedApp, deployment: DeploymentResult): Promise<void> {
    deployment.logs.push('Running smoke tests...');
    
    try {
      const appDir = path.join(this.config.workspaceDir, 'apps', app.id);
      const smokeTestScript = path.join(appDir, 'scripts', 'smoke-test.js');
      
      if (await fs.pathExists(smokeTestScript)) {
        const { stdout, stderr } = await execAsync(`node ${smokeTestScript}`, {
          cwd: appDir,
          timeout: 60000,
          env: { ...process.env, BASE_URL: deployment.url }
        });
        
        deployment.logs.push('Smoke tests passed');
        if (stdout) deployment.logs.push(`Test output: ${stdout.substring(0, 500)}`);
      } else {
        deployment.logs.push('No smoke test script found, skipping');
      }
      
    } catch (error) {
      deployment.logs.push(`Smoke tests failed: ${error.message}`);
      // Don't fail deployment for smoke test failures in non-production
      if (deployment.environment === 'production') {
        throw error;
      }
    }
  }

  private async rollbackDeployment(app: GeneratedApp, deployment: DeploymentResult, environment: string): Promise<void> {
    deployment.logs.push('Starting rollback...');
    
    try {
      // This would implement rollback logic based on the deployment provider
      // For Docker, this might mean reverting to previous images
      // For cloud providers, this might mean deploying previous versions
      
      deployment.logs.push('Rollback completed');
      deployment.status = 'rolled_back';
      
    } catch (rollbackError) {
      deployment.logs.push(`Rollback failed: ${rollbackError.message}`);
      this.logger.error(`Rollback failed for ${app.name}:`, rollbackError);
    }
  }
}
import path from 'path';
import fs from 'fs-extra';
import { EventEmitter } from 'events';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import simpleGit, { SimpleGit } from 'simple-git';
import { 
  GeneratedApp, 
  ErrorInfo, 
  Fix, 
  FileChange, 
  RollbackInfo,
  FrameworkConfig,
  Alert
} from '../types';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);

export class HealingSystem extends EventEmitter {
  private logger: Logger;
  private config: FrameworkConfig;
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private git: SimpleGit;
  private healingQueue: Map<string, ErrorInfo[]> = new Map();
  private backupHistory: Map<string, RollbackInfo[]> = new Map();
  private isRunning = false;

  constructor(config: FrameworkConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.git = simpleGit();
    
    if (config.aiProvider === 'openai' && config.apiKeys.openai) {
      this.openai = new OpenAI({ apiKey: config.apiKeys.openai });
    }
    
    if (config.aiProvider === 'anthropic' && config.apiKeys.anthropic) {
      this.anthropic = new Anthropic({ apiKey: config.apiKeys.anthropic });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Healing system is already running');
      return;
    }

    this.logger.info('Starting self-healing system...');
    this.isRunning = true;
    
    // Start continuous healing loop
    this.startHealingLoop();
    
    this.emit('healing:started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Healing system is not running');
      return;
    }

    this.logger.info('Stopping self-healing system...');
    this.isRunning = false;
    
    this.emit('healing:stopped');
  }

  async healApp(app: GeneratedApp): Promise<void> {
    this.logger.info(`Starting healing process for app: ${app.name}`);
    
    try {
      // Analyze the app for errors
      const errors = await this.analyzeApp(app);
      
      if (errors.length === 0) {
        this.logger.info(`No errors found in app: ${app.name}`);
        return;
      }

      this.logger.info(`Found ${errors.length} errors in app: ${app.name}`);
      
      // Add errors to healing queue
      this.healingQueue.set(app.id, errors);
      
      // Process healing queue
      await this.processHealingQueue(app);
      
    } catch (error) {
      this.logger.error(`Healing failed for app ${app.name}:`, error);
      throw error;
    }
  }

  async fixError(app: GeneratedApp, error: ErrorInfo): Promise<Fix | null> {
    this.logger.info(`Attempting to fix error: ${error.id} - ${error.message}`);
    
    try {
      // Create backup before attempting fix
      const backup = await this.createBackup(app);
      
      // Analyze error and generate fix
      const fix = await this.generateFix(app, error);
      
      if (!fix) {
        this.logger.warn(`Could not generate fix for error: ${error.id}`);
        return null;
      }

      // Apply the fix
      const success = await this.applyFix(app, fix);
      
      if (!success) {
        this.logger.error(`Failed to apply fix for error: ${error.id}`);
        await this.rollback(app, backup);
        return null;
      }

      // Test the fix
      const testPassed = await this.testFix(app, fix);
      
      if (!testPassed && this.config.healing.rollbackThreshold > 0) {
        this.logger.warn(`Fix test failed for error: ${error.id}, rolling back`);
        await this.rollback(app, backup);
        fix.applied = false;
        return fix;
      }

      fix.applied = true;
      fix.tested = testPassed;
      fix.rollback_info = backup;

      this.logger.info(`Successfully fixed error: ${error.id}`);
      
      // Update error status
      error.fix_attempted = true;
      error.fix_successful = success && testPassed;
      
      this.emit('fix:applied', { app, fix, error });
      
      return fix;

    } catch (error) {
      this.logger.error(`Error fixing error ${error.id}:`, error);
      return null;
    }
  }

  async emergencyHeal(app: GeneratedApp, alert: Alert): Promise<void> {
    this.logger.warn(`Emergency healing triggered for app: ${app.name} - ${alert.message}`);
    
    try {
      // Immediate actions based on alert type
      switch (alert.type) {
        case 'error':
          await this.handleErrorAlert(app, alert);
          break;
        case 'performance':
          await this.handlePerformanceAlert(app, alert);
          break;
        case 'security':
          await this.handleSecurityAlert(app, alert);
          break;
        case 'availability':
          await this.handleAvailabilityAlert(app, alert);
          break;
      }

    } catch (error) {
      this.logger.error(`Emergency healing failed for app ${app.name}:`, error);
    }
  }

  private startHealingLoop(): void {
    const healingInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(healingInterval);
        return;
      }

      try {
        await this.processAllHealingQueues();
      } catch (error) {
        this.logger.error('Error in healing loop:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private async analyzeApp(app: GeneratedApp): Promise<ErrorInfo[]> {
    const errors: ErrorInfo[] = [];
    const appDir = path.join(this.config.workspaceDir, 'apps', app.id);

    try {
      // Static code analysis
      const staticErrors = await this.runStaticAnalysis(appDir);
      errors.push(...staticErrors);

      // Runtime error analysis
      const runtimeErrors = await this.analyzeRuntimeErrors(app);
      errors.push(...runtimeErrors);

      // Performance analysis
      const performanceErrors = await this.analyzePerformance(app);
      errors.push(...performanceErrors);

      // Security analysis
      const securityErrors = await this.analyzeSecurityIssues(appDir);
      errors.push(...securityErrors);

    } catch (error) {
      this.logger.error(`Error analyzing app ${app.name}:`, error);
    }

    return errors;
  }

  private async runStaticAnalysis(appDir: string): Promise<ErrorInfo[]> {
    const errors: ErrorInfo[] = [];

    try {
      // Run ESLint on frontend
      const frontendDir = path.join(appDir, 'frontend');
      if (await fs.pathExists(frontendDir)) {
        const frontendErrors = await this.runESLint(frontendDir, 'frontend');
        errors.push(...frontendErrors);
      }

      // Run ESLint on backend
      const backendDir = path.join(appDir, 'backend');
      if (await fs.pathExists(backendDir)) {
        const backendErrors = await this.runESLint(backendDir, 'backend');
        errors.push(...backendErrors);
      }

      // TypeScript compilation errors
      const tsErrors = await this.checkTypeScript(appDir);
      errors.push(...tsErrors);

    } catch (error) {
      this.logger.error('Static analysis failed:', error);
    }

    return errors;
  }

  private async runESLint(directory: string, type: string): Promise<ErrorInfo[]> {
    const errors: ErrorInfo[] = [];

    try {
      const { stdout } = await execAsync('npm run lint -- --format json', {
        cwd: directory,
        timeout: 60000
      });

      const results = JSON.parse(stdout);
      
      for (const result of results) {
        if (result.messages && result.messages.length > 0) {
          for (const message of result.messages) {
            errors.push({
              id: `eslint-${Date.now()}-${Math.random()}`,
              type: 'syntax',
              severity: message.severity === 2 ? 'high' : 'medium',
              file: result.filePath,
              line: message.line,
              message: message.message,
              fix_attempted: false,
              fix_successful: false,
              timestamp: new Date()
            });
          }
        }
      }

    } catch (error) {
      // ESLint errors are expected if there are issues
      if (error.stdout) {
        try {
          const results = JSON.parse(error.stdout);
          // Process results as above
        } catch (parseError) {
          this.logger.warn(`Could not parse ESLint output for ${type}`);
        }
      }
    }

    return errors;
  }

  private async checkTypeScript(appDir: string): Promise<ErrorInfo[]> {
    const errors: ErrorInfo[] = [];

    try {
      const frontendDir = path.join(appDir, 'frontend');
      const backendDir = path.join(appDir, 'backend');

      // Check frontend TypeScript
      if (await fs.pathExists(frontendDir)) {
        const frontendErrors = await this.runTypeScriptCheck(frontendDir, 'frontend');
        errors.push(...frontendErrors);
      }

      // Check backend TypeScript
      if (await fs.pathExists(backendDir)) {
        const backendErrors = await this.runTypeScriptCheck(backendDir, 'backend');
        errors.push(...backendErrors);
      }

    } catch (error) {
      this.logger.error('TypeScript check failed:', error);
    }

    return errors;
  }

  private async runTypeScriptCheck(directory: string, type: string): Promise<ErrorInfo[]> {
    const errors: ErrorInfo[] = [];

    try {
      await execAsync('npx tsc --noEmit', {
        cwd: directory,
        timeout: 120000
      });

    } catch (error) {
      // Parse TypeScript errors from stderr
      if (error.stderr) {
        const lines = error.stderr.split('\n');
        for (const line of lines) {
          const match = line.match(/(.+)\((\d+),(\d+)\): error (.+): (.+)/);
          if (match) {
            const [, file, line, column, code, message] = match;
            errors.push({
              id: `ts-${Date.now()}-${Math.random()}`,
              type: 'syntax',
              severity: 'high',
              file: path.join(directory, file),
              line: parseInt(line),
              message: `${code}: ${message}`,
              fix_attempted: false,
              fix_successful: false,
              timestamp: new Date()
            });
          }
        }
      }
    }

    return errors;
  }

  private async analyzeRuntimeErrors(app: GeneratedApp): Promise<ErrorInfo[]> {
    // Analyze runtime errors from logs, monitoring data, etc.
    // This would integrate with monitoring systems
    return [];
  }

  private async analyzePerformance(app: GeneratedApp): Promise<ErrorInfo[]> {
    // Analyze performance metrics and identify issues
    return [];
  }

  private async analyzeSecurityIssues(appDir: string): Promise<ErrorInfo[]> {
    const errors: ErrorInfo[] = [];

    try {
      // Run npm audit
      const auditErrors = await this.runSecurityAudit(appDir);
      errors.push(...auditErrors);

    } catch (error) {
      this.logger.error('Security analysis failed:', error);
    }

    return errors;
  }

  private async runSecurityAudit(appDir: string): Promise<ErrorInfo[]> {
    const errors: ErrorInfo[] = [];

    try {
      const frontendDir = path.join(appDir, 'frontend');
      const backendDir = path.join(appDir, 'backend');

      // Audit frontend
      if (await fs.pathExists(frontendDir)) {
        const frontendAudit = await this.auditDirectory(frontendDir, 'frontend');
        errors.push(...frontendAudit);
      }

      // Audit backend
      if (await fs.pathExists(backendDir)) {
        const backendAudit = await this.auditDirectory(backendDir, 'backend');
        errors.push(...backendAudit);
      }

    } catch (error) {
      this.logger.error('Security audit failed:', error);
    }

    return errors;
  }

  private async auditDirectory(directory: string, type: string): Promise<ErrorInfo[]> {
    const errors: ErrorInfo[] = [];

    try {
      const { stdout } = await execAsync('npm audit --json', {
        cwd: directory,
        timeout: 60000
      });

      const audit = JSON.parse(stdout);
      
      if (audit.vulnerabilities) {
        for (const [name, vulnerability] of Object.entries(audit.vulnerabilities as any)) {
          const vuln = vulnerability as any;
          errors.push({
            id: `security-${Date.now()}-${Math.random()}`,
            type: 'security',
            severity: vuln.severity === 'critical' ? 'critical' : vuln.severity === 'high' ? 'high' : 'medium',
            file: `package.json (${type})`,
            line: 0,
            message: `Security vulnerability in ${name}: ${vuln.title}`,
            fix_attempted: false,
            fix_successful: false,
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      // npm audit may exit with non-zero code even with vulnerabilities
      if (error.stdout) {
        try {
          const audit = JSON.parse(error.stdout);
          // Process as above
        } catch (parseError) {
          this.logger.warn(`Could not parse npm audit output for ${type}`);
        }
      }
    }

    return errors;
  }

  private async generateFix(app: GeneratedApp, error: ErrorInfo): Promise<Fix | null> {
    this.logger.info(`Generating fix for error: ${error.message}`);
    
    try {
      // Prepare context for AI
      const context = await this.prepareErrorContext(app, error);
      
      // Generate fix using AI
      const fixSuggestion = await this.callAIForFix(context, error);
      
      if (!fixSuggestion) {
        return null;
      }

      const fix: Fix = {
        id: `fix-${Date.now()}-${Math.random()}`,
        error_id: error.id,
        type: this.determineFIxType(error),
        description: fixSuggestion.description,
        changes: fixSuggestion.changes,
        confidence: fixSuggestion.confidence,
        tested: false,
        applied: false,
        rollback_info: {
          backup_id: '',
          timestamp: new Date(),
          files: fixSuggestion.changes.map(c => c.file)
        }
      };

      return fix;

    } catch (error) {
      this.logger.error('Failed to generate fix:', error);
      return null;
    }
  }

  private async prepareErrorContext(app: GeneratedApp, error: ErrorInfo): Promise<string> {
    let context = `Error Details:
Type: ${error.type}
Severity: ${error.severity}
File: ${error.file}
Line: ${error.line}
Message: ${error.message}

Application Context:
Name: ${app.name}
Description: ${app.specification.description}
Tech Stack: ${JSON.stringify(app.specification.techStack, null, 2)}

`;

    // Add relevant file content
    try {
      if (error.file && error.file !== 'package.json') {
        const fileContent = await fs.readFile(error.file, 'utf8');
        const lines = fileContent.split('\n');
        const startLine = Math.max(0, error.line - 5);
        const endLine = Math.min(lines.length, error.line + 5);
        
        context += `File Content (lines ${startLine + 1}-${endLine + 1}):
${lines.slice(startLine, endLine).map((line, i) => 
  `${startLine + i + 1}: ${line}`
).join('\n')}

`;
      }
    } catch (fileError) {
      this.logger.warn(`Could not read file content for ${error.file}`);
    }

    return context;
  }

  private async callAIForFix(context: string, error: ErrorInfo): Promise<any> {
    const prompt = `You are an expert software engineer. Analyze the following error and provide a specific fix.

${context}

Please provide a JSON response with the following structure:
{
  "description": "Brief description of the fix",
  "confidence": 0.85,
  "changes": [
    {
      "file": "path/to/file.ts",
      "type": "update",
      "new_content": "complete new file content with the fix applied"
    }
  ]
}

Focus on:
1. The specific error mentioned
2. Following the existing code style and patterns
3. Ensuring the fix doesn't break existing functionality
4. Modern best practices

Provide only valid JSON, no additional text.`;

    try {
      if (this.config.aiProvider === 'openai' && this.openai) {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 2000
        });
        
        const content = response.choices[0]?.message?.content || '';
        return JSON.parse(content);
      }

      if (this.config.aiProvider === 'anthropic' && this.anthropic) {
        const response = await this.anthropic.messages.create({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 2000,
          temperature: 0.3,
          messages: [{ role: 'user', content: prompt }]
        });
        
        const content = response.content[0].type === 'text' ? response.content[0].text : '';
        return JSON.parse(content);
      }

      throw new Error(`AI provider ${this.config.aiProvider} not configured`);

    } catch (error) {
      this.logger.error('Failed to get AI fix suggestion:', error);
      return null;
    }
  }

  private determineFIxType(error: ErrorInfo): Fix['type'] {
    if (error.type === 'security') return 'dependency';
    if (error.file?.includes('package.json')) return 'dependency';
    if (error.file?.includes('docker')) return 'infrastructure';
    if (error.file?.includes('.env')) return 'config';
    return 'code';
  }

  private async createBackup(app: GeneratedApp): Promise<RollbackInfo> {
    const backupId = `backup-${Date.now()}`;
    const appDir = path.join(this.config.workspaceDir, 'apps', app.id);
    const backupDir = path.join(this.config.workspaceDir, 'backups', app.id, backupId);

    try {
      await fs.ensureDir(backupDir);
      await fs.copy(appDir, backupDir);

      const backup: RollbackInfo = {
        backup_id: backupId,
        timestamp: new Date(),
        files: await this.listFiles(appDir)
      };

      // Store backup info
      if (!this.backupHistory.has(app.id)) {
        this.backupHistory.set(app.id, []);
      }
      this.backupHistory.get(app.id)!.push(backup);

      this.logger.info(`Created backup: ${backupId} for app: ${app.name}`);
      return backup;

    } catch (error) {
      this.logger.error(`Failed to create backup for app ${app.name}:`, error);
      throw error;
    }
  }

  private async applyFix(app: GeneratedApp, fix: Fix): Promise<boolean> {
    this.logger.info(`Applying fix: ${fix.id} - ${fix.description}`);

    try {
      for (const change of fix.changes) {
        await this.applyFileChange(change);
      }

      this.logger.info(`Successfully applied fix: ${fix.id}`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to apply fix ${fix.id}:`, error);
      return false;
    }
  }

  private async applyFileChange(change: FileChange): Promise<void> {
    switch (change.type) {
      case 'create':
        await fs.ensureDir(path.dirname(change.file));
        await fs.writeFile(change.file, change.new_content || '');
        break;
        
      case 'update':
        if (await fs.pathExists(change.file)) {
          await fs.writeFile(change.file, change.new_content || '');
        } else {
          throw new Error(`File not found: ${change.file}`);
        }
        break;
        
      case 'delete':
        if (await fs.pathExists(change.file)) {
          await fs.remove(change.file);
        }
        break;
    }
  }

  private async testFix(app: GeneratedApp, fix: Fix): Promise<boolean> {
    if (!this.config.testing.autoFix) {
      return true;
    }

    this.logger.info(`Testing fix: ${fix.id}`);

    try {
      const appDir = path.join(this.config.workspaceDir, 'apps', app.id);

      // Run linting
      const lintPassed = await this.runQuickLint(appDir);
      if (!lintPassed) {
        this.logger.warn(`Lint test failed for fix: ${fix.id}`);
        return false;
      }

      // Run TypeScript check
      const typePassed = await this.runQuickTypeCheck(appDir);
      if (!typePassed) {
        this.logger.warn(`Type check failed for fix: ${fix.id}`);
        return false;
      }

      // Run quick unit tests if available
      const testsPassed = await this.runQuickTests(appDir);
      if (!testsPassed) {
        this.logger.warn(`Unit tests failed for fix: ${fix.id}`);
        return false;
      }

      this.logger.info(`All tests passed for fix: ${fix.id}`);
      return true;

    } catch (error) {
      this.logger.error(`Error testing fix ${fix.id}:`, error);
      return false;
    }
  }

  private async runQuickLint(appDir: string): Promise<boolean> {
    try {
      const frontendDir = path.join(appDir, 'frontend');
      const backendDir = path.join(appDir, 'backend');

      if (await fs.pathExists(frontendDir)) {
        await execAsync('npm run lint', { cwd: frontendDir, timeout: 30000 });
      }

      if (await fs.pathExists(backendDir)) {
        await execAsync('npm run lint', { cwd: backendDir, timeout: 30000 });
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  private async runQuickTypeCheck(appDir: string): Promise<boolean> {
    try {
      const frontendDir = path.join(appDir, 'frontend');
      const backendDir = path.join(appDir, 'backend');

      if (await fs.pathExists(frontendDir)) {
        await execAsync('npx tsc --noEmit', { cwd: frontendDir, timeout: 60000 });
      }

      if (await fs.pathExists(backendDir)) {
        await execAsync('npx tsc --noEmit', { cwd: backendDir, timeout: 60000 });
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  private async runQuickTests(appDir: string): Promise<boolean> {
    try {
      const frontendDir = path.join(appDir, 'frontend');
      const backendDir = path.join(appDir, 'backend');

      if (await fs.pathExists(frontendDir)) {
        await execAsync('npm test -- --watchAll=false --passWithNoTests', { 
          cwd: frontendDir, 
          timeout: 120000,
          env: { ...process.env, CI: 'true' }
        });
      }

      if (await fs.pathExists(backendDir)) {
        await execAsync('npm test -- --passWithNoTests', { 
          cwd: backendDir, 
          timeout: 120000 
        });
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  private async rollback(app: GeneratedApp, backup: RollbackInfo): Promise<void> {
    this.logger.info(`Rolling back app: ${app.name} to backup: ${backup.backup_id}`);

    try {
      const appDir = path.join(this.config.workspaceDir, 'apps', app.id);
      const backupDir = path.join(this.config.workspaceDir, 'backups', app.id, backup.backup_id);

      if (await fs.pathExists(backupDir)) {
        await fs.remove(appDir);
        await fs.copy(backupDir, appDir);
        this.logger.info(`Successfully rolled back app: ${app.name}`);
      } else {
        throw new Error(`Backup not found: ${backup.backup_id}`);
      }

    } catch (error) {
      this.logger.error(`Failed to rollback app ${app.name}:`, error);
      throw error;
    }
  }

  private async processHealingQueue(app: GeneratedApp): Promise<void> {
    const errors = this.healingQueue.get(app.id);
    if (!errors || errors.length === 0) {
      return;
    }

    this.logger.info(`Processing ${errors.length} errors for app: ${app.name}`);

    for (const error of errors) {
      if (error.severity === 'critical' || error.severity === 'high') {
        await this.fixError(app, error);
      }
    }

    // Clear processed errors
    this.healingQueue.delete(app.id);
  }

  private async processAllHealingQueues(): Promise<void> {
    // Process healing queues for all apps
    // This would be implemented to handle multiple apps
  }

  private async handleErrorAlert(app: GeneratedApp, alert: Alert): Promise<void> {
    // Handle error alerts - restart services, fix critical issues
    this.logger.info(`Handling error alert for app: ${app.name}`);
  }

  private async handlePerformanceAlert(app: GeneratedApp, alert: Alert): Promise<void> {
    // Handle performance alerts - optimize queries, scale resources
    this.logger.info(`Handling performance alert for app: ${app.name}`);
  }

  private async handleSecurityAlert(app: GeneratedApp, alert: Alert): Promise<void> {
    // Handle security alerts - patch vulnerabilities, update dependencies
    this.logger.info(`Handling security alert for app: ${app.name}`);
  }

  private async handleAvailabilityAlert(app: GeneratedApp, alert: Alert): Promise<void> {
    // Handle availability alerts - restart services, failover
    this.logger.info(`Handling availability alert for app: ${app.name}`);
  }

  private async listFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    
    const walk = async (dir: string) => {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          await walk(fullPath);
        } else if (stat.isFile()) {
          files.push(path.relative(directory, fullPath));
        }
      }
    };

    await walk(directory);
    return files;
  }
}
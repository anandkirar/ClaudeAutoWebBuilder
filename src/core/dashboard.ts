import express, { Express, Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import WebSocket from 'ws';
import { createServer } from 'http';
import { 
  GeneratedApp, 
  FrameworkConfig,
  HealthStatus,
  PerformanceMetrics,
  TestSuite,
  DeploymentResult
} from '../types';
import { Logger } from '../utils/logger';

export class Dashboard {
  private app: Express;
  private server: any;
  private wss: WebSocket.Server;
  private logger: Logger;
  private config: FrameworkConfig;
  private port = 3100;
  private isRunning = false;
  
  // Data stores (would integrate with database in production)
  private apps: Map<string, GeneratedApp> = new Map();
  private deployments: Map<string, DeploymentResult[]> = new Map();
  private testResults: Map<string, TestSuite[]> = new Map();

  constructor(config: FrameworkConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Dashboard is already running');
      return;
    }

    try {
      await this.generateDashboardFiles();
      
      this.server.listen(this.port, () => {
        this.logger.info(`Dashboard running at http://localhost:${this.port}`);
        this.isRunning = true;
      });
      
    } catch (error) {
      this.logger.error('Failed to start dashboard:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Dashboard is not running');
      return;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.wss.close();
        this.isRunning = false;
        this.logger.info('Dashboard stopped');
        resolve();
      });
    });
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Serve static files from dashboard directory
    const dashboardPublicDir = path.join(this.config.workspaceDir, 'dashboard', 'public');
    this.app.use(express.static(dashboardPublicDir));
    
    // CORS for API requests
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes(): void {
    // Dashboard home
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(this.config.workspaceDir, 'dashboard', 'public', 'index.html'));
    });

    // API Routes
    this.app.get('/api/apps', this.getApps.bind(this));
    this.app.get('/api/apps/:id', this.getApp.bind(this));
    this.app.post('/api/apps', this.createApp.bind(this));
    this.app.delete('/api/apps/:id', this.deleteApp.bind(this));
    
    this.app.get('/api/apps/:id/health', this.getAppHealth.bind(this));
    this.app.get('/api/apps/:id/metrics', this.getAppMetrics.bind(this));
    this.app.get('/api/apps/:id/tests', this.getAppTests.bind(this));
    this.app.get('/api/apps/:id/deployments', this.getAppDeployments.bind(this));
    
    this.app.post('/api/apps/:id/deploy', this.deployApp.bind(this));
    this.app.post('/api/apps/:id/test', this.testApp.bind(this));
    
    // Framework status
    this.app.get('/api/status', this.getFrameworkStatus.bind(this));
    this.app.get('/api/config', this.getFrameworkConfig.bind(this));
    
    // Analytics
    this.app.get('/api/analytics/overview', this.getAnalyticsOverview.bind(this));
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      this.logger.info('Dashboard client connected');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          this.logger.error('Invalid WebSocket message:', error);
        }
      });
      
      ws.on('close', () => {
        this.logger.info('Dashboard client disconnected');
      });
    });
  }

  private handleWebSocketMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'subscribe':
        // Handle subscription to real-time updates
        ws.send(JSON.stringify({ type: 'subscribed', data: data.topics }));
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
    }
  }

  // API Route Handlers
  private async getApps(req: Request, res: Response): Promise<void> {
    try {
      const apps = Array.from(this.apps.values());
      res.json({
        success: true,
        data: apps,
        count: apps.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  private async getApp(req: Request, res: Response): Promise<void> {
    try {
      const app = this.apps.get(req.params.id);
      if (!app) {
        return res.status(404).json({
          success: false,
          message: 'App not found'
        });
      }
      
      res.json({
        success: true,
        data: app
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  private async createApp(req: Request, res: Response): Promise<void> {
    try {
      const { requirements } = req.body;
      
      if (!requirements) {
        return res.status(400).json({
          success: false,
          message: 'Requirements are required'
        });
      }
      
      // This would integrate with the main framework to create an app
      res.json({
        success: true,
        message: 'App creation started',
        data: { requirements }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  private async deleteApp(req: Request, res: Response): Promise<void> {
    try {
      const appId = req.params.id;
      const app = this.apps.get(appId);
      
      if (!app) {
        return res.status(404).json({
          success: false,
          message: 'App not found'
        });
      }
      
      this.apps.delete(appId);
      this.deployments.delete(appId);
      this.testResults.delete(appId);
      
      res.json({
        success: true,
        message: 'App deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  private async getAppHealth(req: Request, res: Response): Promise<void> {
    try {
      const app = this.apps.get(req.params.id);
      if (!app) {
        return res.status(404).json({
          success: false,
          message: 'App not found'
        });
      }
      
      res.json({
        success: true,
        data: app.health
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  private async getAppMetrics(req: Request, res: Response): Promise<void> {
    try {
      const app = this.apps.get(req.params.id);
      if (!app) {
        return res.status(404).json({
          success: false,
          message: 'App not found'
        });
      }
      
      // This would fetch actual metrics from monitoring system
      res.json({
        success: true,
        data: app.metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  private async getAppTests(req: Request, res: Response): Promise<void> {
    try {
      const testSuites = this.testResults.get(req.params.id) || [];
      
      res.json({
        success: true,
        data: testSuites
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  private async getAppDeployments(req: Request, res: Response): Promise<void> {
    try {
      const deployments = this.deployments.get(req.params.id) || [];
      
      res.json({
        success: true,
        data: deployments
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  private async deployApp(req: Request, res: Response): Promise<void> {
    try {
      const { environment = 'development' } = req.body;
      
      // This would integrate with deployment manager
      res.json({
        success: true,
        message: 'Deployment started',
        data: { environment }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  private async testApp(req: Request, res: Response): Promise<void> {
    try {
      // This would integrate with testing engine
      res.json({
        success: true,
        message: 'Testing started'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  private async getFrameworkStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = {
        running: this.isRunning,
        uptime: process.uptime() * 1000,
        memory: process.memoryUsage(),
        version: '1.0.0',
        apps: this.apps.size,
        activeDeployments: Array.from(this.deployments.values()).reduce((acc, deployments) => 
          acc + deployments.filter(d => d.status === 'deploying').length, 0
        )
      };
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  private async getFrameworkConfig(req: Request, res: Response): Promise<void> {
    try {
      // Return safe config (without API keys)
      const safeConfig = {
        aiProvider: this.config.aiProvider,
        database: {
          type: this.config.database.type
        },
        deployment: this.config.deployment,
        monitoring: this.config.monitoring,
        testing: this.config.testing,
        healing: this.config.healing,
        logLevel: this.config.logLevel
      };
      
      res.json({
        success: true,
        data: safeConfig
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  private async getAnalyticsOverview(req: Request, res: Response): Promise<void> {
    try {
      const apps = Array.from(this.apps.values());
      
      const overview = {
        totalApps: apps.length,
        healthyApps: apps.filter(app => app.health.overall === 'healthy').length,
        warningApps: apps.filter(app => app.health.overall === 'warning').length,
        criticalApps: apps.filter(app => app.health.overall === 'critical').length,
        totalDeployments: Array.from(this.deployments.values()).reduce((acc, deployments) => acc + deployments.length, 0),
        successfulDeployments: Array.from(this.deployments.values()).reduce((acc, deployments) => 
          acc + deployments.filter(d => d.status === 'success').length, 0
        ),
        avgResponseTime: apps.reduce((acc, app) => acc + app.health.performance.responseTime, 0) / apps.length || 0,
        totalErrors: apps.reduce((acc, app) => acc + app.health.errors.length, 0)
      };
      
      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Generate static dashboard files
  private async generateDashboardFiles(): Promise<void> {
    const dashboardDir = path.join(this.config.workspaceDir, 'dashboard');
    const publicDir = path.join(dashboardDir, 'public');
    
    await fs.ensureDir(publicDir);
    
    // Generate index.html
    const indexHtml = this.generateDashboardHTML();
    await fs.writeFile(path.join(publicDir, 'index.html'), indexHtml);
    
    // Generate dashboard CSS
    const dashboardCSS = this.generateDashboardCSS();
    await fs.writeFile(path.join(publicDir, 'dashboard.css'), dashboardCSS);
    
    // Generate dashboard JavaScript
    const dashboardJS = this.generateDashboardJS();
    await fs.writeFile(path.join(publicDir, 'dashboard.js'), dashboardJS);
    
    this.logger.info('Dashboard files generated');
  }

  private generateDashboardHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Autonomous Web Framework Dashboard</title>
    <link rel="stylesheet" href="/dashboard.css">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
</head>
<body>
    <div id="app">
        <header class="header">
            <div class="container">
                <h1><i class="fas fa-robot"></i> Autonomous Web Framework</h1>
                <div class="header-actions">
                    <button id="create-app-btn" class="btn btn-primary">
                        <i class="fas fa-plus"></i> Create App
                    </button>
                    <button id="refresh-btn" class="btn btn-secondary">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
        </header>

        <main class="main">
            <div class="container">
                <!-- Overview Cards -->
                <section class="overview">
                    <div class="card">
                        <div class="card-header">
                            <h3><i class="fas fa-chart-line"></i> Overview</h3>
                        </div>
                        <div class="card-content">
                            <div class="stats-grid">
                                <div class="stat">
                                    <div class="stat-value" id="total-apps">0</div>
                                    <div class="stat-label">Total Apps</div>
                                </div>
                                <div class="stat">
                                    <div class="stat-value" id="healthy-apps">0</div>
                                    <div class="stat-label">Healthy</div>
                                </div>
                                <div class="stat">
                                    <div class="stat-value" id="warning-apps">0</div>
                                    <div class="stat-label">Warning</div>
                                </div>
                                <div class="stat">
                                    <div class="stat-value" id="critical-apps">0</div>
                                    <div class="stat-label">Critical</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Applications List -->
                <section class="apps-section">
                    <div class="card">
                        <div class="card-header">
                            <h3><i class="fas fa-layer-group"></i> Applications</h3>
                            <div class="filter-controls">
                                <select id="status-filter">
                                    <option value="">All Status</option>
                                    <option value="healthy">Healthy</option>
                                    <option value="warning">Warning</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </div>
                        </div>
                        <div class="card-content">
                            <div id="apps-list" class="apps-list">
                                <div class="loading">Loading applications...</div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    </div>

    <!-- Create App Modal -->
    <div id="create-app-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Create New Application</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="create-app-form">
                    <div class="form-group">
                        <label for="app-requirements">Describe your application:</label>
                        <textarea 
                            id="app-requirements" 
                            rows="6" 
                            placeholder="Example: Create a task management application with user authentication, real-time collaboration, file attachments, and mobile support."
                            required
                        ></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="cancel-create">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create Application</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script src="/dashboard.js"></script>
</body>
</html>`;
  }

  private generateDashboardCSS(): string {
    return `/* Dashboard Styles */
:root {
    --primary-color: #3b82f6;
    --secondary-color: #6b7280;
    --success-color: #10b981;
    --warning-color: #f59e0b;
    --danger-color: #ef4444;
    --background-color: #f9fafb;
    --surface-color: #ffffff;
    --text-color: #111827;
    --text-muted: #6b7280;
    --border-color: #e5e7eb;
    --border-radius: 8px;
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: var(--background-color);
    color: var(--text-color);
    line-height: 1.5;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Header */
.header {
    background: var(--surface-color);
    border-bottom: 1px solid var(--border-color);
    padding: 1rem 0;
    box-shadow: var(--shadow);
}

.header .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header h1 {
    color: var(--primary-color);
    font-size: 1.5rem;
    font-weight: 700;
}

.header-actions {
    display: flex;
    gap: 0.5rem;
}

/* Buttons */
.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--border-radius);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
}

.btn-primary {
    background: var(--primary-color);
    color: white;
}

.btn-primary:hover {
    background: #2563eb;
}

.btn-secondary {
    background: var(--surface-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
}

.btn-secondary:hover {
    background: #f3f4f6;
}

.btn-success {
    background: var(--success-color);
    color: white;
}

.btn-warning {
    background: var(--warning-color);
    color: white;
}

.btn-danger {
    background: var(--danger-color);
    color: white;
}

/* Main Content */
.main {
    padding: 2rem 0;
}

/* Cards */
.card {
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow);
    margin-bottom: 2rem;
}

.card-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.card-header h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-color);
}

.card-content {
    padding: 1.5rem;
}

/* Overview Stats */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 2rem;
}

.stat {
    text-align: center;
}

.stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--primary-color);
    margin-bottom: 0.5rem;
}

.stat-label {
    color: var(--text-muted);
    font-size: 0.875rem;
}

/* Applications List */
.apps-list {
    display: grid;
    gap: 1rem;
}

.app-card {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    transition: all 0.2s;
}

.app-card:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.app-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
}

.app-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
}

.app-description {
    color: var(--text-muted);
    font-size: 0.875rem;
}

.app-status {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.status-healthy {
    background: #dcfce7;
    color: #166534;
}

.status-warning {
    background: #fef3c7;
    color: #92400e;
}

.status-critical {
    background: #fee2e2;
    color: #991b1b;
}

.app-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.875rem;
    color: var(--text-muted);
}

.app-actions {
    display: flex;
    gap: 0.5rem;
}

.app-actions .btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
}

/* Modal */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
}

.modal.active {
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-content {
    background: var(--surface-color);
    border-radius: var(--border-radius);
    max-width: 500px;
    width: 90%;
    max-height: 90%;
    overflow-y: auto;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h3 {
    font-size: 1.25rem;
    font-weight: 600;
}

.modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-muted);
}

.modal-body {
    padding: 1.5rem;
}

/* Forms */
.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-color);
}

.form-group input,
.form-group textarea,
.form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: 0.875rem;
    transition: border-color 0.2s;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
}

/* Filter Controls */
.filter-controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.filter-controls select {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--surface-color);
    font-size: 0.875rem;
}

/* Loading */
.loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
}

/* Responsive */
@media (max-width: 768px) {
    .container {
        padding: 0 1rem;
    }
    
    .header .container {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
    }
    
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
    }
    
    .app-header,
    .app-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
}`;
  }

  private generateDashboardJS(): string {
    return `// Dashboard JavaScript
class Dashboard {
    constructor() {
        this.baseURL = '';
        this.ws = null;
        this.apps = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.connectWebSocket();
        await this.loadData();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Create app button
        document.getElementById('create-app-btn').addEventListener('click', () => {
            this.showCreateAppModal();
        });

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadData();
        });

        // Modal close
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.hideCreateAppModal();
        });

        // Cancel create app
        document.getElementById('cancel-create').addEventListener('click', () => {
            this.hideCreateAppModal();
        });

        // Create app form
        document.getElementById('create-app-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createApp();
        });

        // Status filter
        document.getElementById('status-filter').addEventListener('change', (e) => {
            this.filterApps(e.target.value);
        });

        // Close modal on backdrop click
        document.getElementById('create-app-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideCreateAppModal();
            }
        });
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsURL = \`\${protocol}//\${window.location.host}\`;
        
        this.ws = new WebSocket(wsURL);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                topics: ['apps', 'health', 'deployments']
            }));
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            // Reconnect after 5 seconds
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'app_updated':
                this.updateAppInList(data.app);
                break;
            case 'health_updated':
                this.updateAppHealth(data.app_id, data.health);
                break;
            case 'deployment_status':
                this.updateDeploymentStatus(data.deployment);
                break;
        }
    }

    async loadData() {
        try {
            const [appsResponse, overviewResponse] = await Promise.all([
                fetch('/api/apps'),
                fetch('/api/analytics/overview')
            ]);
            
            if (appsResponse.ok) {
                const appsData = await appsResponse.json();
                this.apps = appsData.data;
                this.renderApps();
            }
            
            if (overviewResponse.ok) {
                const overviewData = await overviewResponse.json();
                this.updateOverview(overviewData.data);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    updateOverview(data) {
        document.getElementById('total-apps').textContent = data.totalApps || 0;
        document.getElementById('healthy-apps').textContent = data.healthyApps || 0;
        document.getElementById('warning-apps').textContent = data.warningApps || 0;
        document.getElementById('critical-apps').textContent = data.criticalApps || 0;
    }

    renderApps(apps = this.apps) {
        const appsList = document.getElementById('apps-list');
        
        if (apps.length === 0) {
            appsList.innerHTML = '<div class="loading">No applications found</div>';
            return;
        }
        
        appsList.innerHTML = apps.map(app => this.renderAppCard(app)).join('');
        
        // Add event listeners to app actions
        appsList.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const appId = e.target.dataset.appId;
                this.handleAppAction(action, appId);
            });
        });
    }

    renderAppCard(app) {
        const statusClass = \`status-\${app.health?.overall || 'unknown'}\`;
        const createdDate = new Date(app.created_at).toLocaleDateString();
        
        return \`
            <div class="app-card">
                <div class="app-header">
                    <div>
                        <div class="app-title">\${app.name}</div>
                        <div class="app-description">\${app.specification.description}</div>
                    </div>
                    <span class="app-status \${statusClass}">
                        \${app.health?.overall || 'Unknown'}
                    </span>
                </div>
                <div class="app-meta">
                    <span>Created: \${createdDate}</span>
                    <div class="app-actions">
                        <button class="btn btn-secondary" data-action="view" data-app-id="\${app.id}">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn btn-success" data-action="deploy" data-app-id="\${app.id}">
                            <i class="fas fa-rocket"></i> Deploy
                        </button>
                        <button class="btn btn-warning" data-action="test" data-app-id="\${app.id}">
                            <i class="fas fa-vial"></i> Test
                        </button>
                        <button class="btn btn-danger" data-action="delete" data-app-id="\${app.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        \`;
    }

    filterApps(status) {
        if (!status) {
            this.renderApps();
            return;
        }
        
        const filteredApps = this.apps.filter(app => 
            app.health?.overall === status
        );
        this.renderApps(filteredApps);
    }

    async handleAppAction(action, appId) {
        switch (action) {
            case 'view':
                this.viewApp(appId);
                break;
            case 'deploy':
                await this.deployApp(appId);
                break;
            case 'test':
                await this.testApp(appId);
                break;
            case 'delete':
                await this.deleteApp(appId);
                break;
        }
    }

    viewApp(appId) {
        // This would open a detailed view of the app
        window.open(\`/apps/\${appId}\`, '_blank');
    }

    async deployApp(appId) {
        if (!confirm('Are you sure you want to deploy this application?')) {
            return;
        }
        
        try {
            const response = await fetch(\`/api/apps/\${appId}/deploy\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ environment: 'development' })
            });
            
            if (response.ok) {
                this.showSuccess('Deployment started');
            } else {
                this.showError('Failed to start deployment');
            }
        } catch (error) {
            this.showError('Failed to deploy application');
        }
    }

    async testApp(appId) {
        try {
            const response = await fetch(\`/api/apps/\${appId}/test\`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.showSuccess('Tests started');
            } else {
                this.showError('Failed to start tests');
            }
        } catch (error) {
            this.showError('Failed to test application');
        }
    }

    async deleteApp(appId) {
        if (!confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(\`/api/apps/\${appId}\`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showSuccess('Application deleted');
                await this.loadData();
            } else {
                this.showError('Failed to delete application');
            }
        } catch (error) {
            this.showError('Failed to delete application');
        }
    }

    showCreateAppModal() {
        document.getElementById('create-app-modal').classList.add('active');
    }

    hideCreateAppModal() {
        document.getElementById('create-app-modal').classList.remove('active');
        document.getElementById('create-app-form').reset();
    }

    async createApp() {
        const requirements = document.getElementById('app-requirements').value;
        
        if (!requirements.trim()) {
            this.showError('Please describe your application requirements');
            return;
        }
        
        try {
            const response = await fetch('/api/apps', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ requirements })
            });
            
            if (response.ok) {
                this.hideCreateAppModal();
                this.showSuccess('Application creation started');
                // Refresh data after a short delay
                setTimeout(() => this.loadData(), 2000);
            } else {
                this.showError('Failed to create application');
            }
        } catch (error) {
            this.showError('Failed to create application');
        }
    }

    startAutoRefresh() {
        // Refresh data every 30 seconds
        setInterval(() => {
            this.loadData();
        }, 30000);
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Simple notification system
        const notification = document.createElement('div');
        notification.className = \`notification notification-\${type}\`;
        notification.textContent = message;
        
        const style = document.createElement('style');
        style.textContent = \`
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem;
                border-radius: 8px;
                color: white;
                z-index: 1001;
                animation: slideIn 0.3s ease;
            }
            .notification-success { background: #10b981; }
            .notification-error { background: #ef4444; }
            @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
        \`;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 5000);
    }

    updateAppInList(updatedApp) {
        const index = this.apps.findIndex(app => app.id === updatedApp.id);
        if (index !== -1) {
            this.apps[index] = updatedApp;
            this.renderApps();
        }
    }

    updateAppHealth(appId, health) {
        const app = this.apps.find(app => app.id === appId);
        if (app) {
            app.health = health;
            this.renderApps();
        }
    }

    updateDeploymentStatus(deployment) {
        // Update deployment status in real-time
        console.log('Deployment status updated:', deployment);
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});`;
  }

  // Public methods for framework integration
  updateApp(app: GeneratedApp): void {
    this.apps.set(app.id, app);
    this.broadcastToClients('app_updated', { app });
  }

  updateHealth(appId: string, health: HealthStatus): void {
    const app = this.apps.get(appId);
    if (app) {
      app.health = health;
      this.broadcastToClients('health_updated', { app_id: appId, health });
    }
  }

  updateDeployment(deployment: DeploymentResult): void {
    const appDeployments = this.deployments.get(deployment.app_id) || [];
    const index = appDeployments.findIndex(d => d.id === deployment.id);
    
    if (index !== -1) {
      appDeployments[index] = deployment;
    } else {
      appDeployments.push(deployment);
    }
    
    this.deployments.set(deployment.app_id, appDeployments);
    this.broadcastToClients('deployment_status', { deployment });
  }

  updateTestResults(appId: string, testSuites: TestSuite[]): void {
    this.testResults.set(appId, testSuites);
    this.broadcastToClients('test_results', { app_id: appId, test_suites: testSuites });
  }

  private broadcastToClients(type: string, data: any): void {
    const message = JSON.stringify({ type, ...data });
    
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}
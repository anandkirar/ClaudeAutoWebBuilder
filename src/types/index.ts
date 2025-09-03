export interface FrameworkConfig {
  aiProvider: 'openai' | 'anthropic' | 'local';
  apiKeys: {
    openai?: string;
    anthropic?: string;
  };
  database: DatabaseConfig;
  deployment: DeploymentConfig;
  monitoring: MonitoringConfig;
  testing: TestingConfig;
  healing: HealingConfig;
  workspaceDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface DatabaseConfig {
  type: 'postgresql' | 'mongodb' | 'sqlite';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  url?: string;
}

export interface DeploymentConfig {
  provider: 'docker' | 'vercel' | 'netlify' | 'aws' | 'gcp';
  environment: 'development' | 'staging' | 'production';
  autoScale: boolean;
  healthChecks: boolean;
  rollbackOnFailure: boolean;
}

export interface MonitoringConfig {
  enableRealTime: boolean;
  errorTracking: boolean;
  performanceMetrics: boolean;
  userAnalytics: boolean;
  alertWebhooks: string[];
}

export interface TestingConfig {
  unitTests: boolean;
  integrationTests: boolean;
  e2eTests: boolean;
  visualRegression: boolean;
  performanceTesting: boolean;
  accessibility: boolean;
  autoFix: boolean;
}

export interface HealingConfig {
  autoFix: boolean;
  retryAttempts: number;
  rollbackThreshold: number;
  learningMode: boolean;
  notifyOnFix: boolean;
}

export interface RequirementSpec {
  id: string;
  title: string;
  description: string;
  features: Feature[];
  techStack: TechStack;
  authentication: boolean;
  database: boolean;
  realtime: boolean;
  fileUploads: boolean;
  notifications: boolean;
  mobileSupport: boolean;
  apiEndpoints: APIEndpoint[];
  uiComponents: UIComponent[];
  businessLogic: BusinessRule[];
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  complexity: 'simple' | 'moderate' | 'complex';
  dependencies: string[];
  acceptance_criteria: string[];
}

export interface TechStack {
  frontend: {
    framework: 'react' | 'vue' | 'angular';
    styling: 'tailwind' | 'styled-components' | 'css-modules';
    stateManagement: 'redux' | 'zustand' | 'context' | 'none';
    typescript: boolean;
  };
  backend: {
    framework: 'express' | 'fastify' | 'nest';
    language: 'typescript' | 'javascript';
    authentication: 'jwt' | 'oauth' | 'session' | 'none';
  };
  database: DatabaseConfig;
  testing: string[];
  deployment: string[];
}

export interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  parameters: Parameter[];
  response: ResponseSchema;
  authentication: boolean;
  validation: ValidationRule[];
}

export interface Parameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  validation?: ValidationRule[];
}

export interface ResponseSchema {
  type: 'object' | 'array';
  properties: Record<string, any>;
  status_codes: number[];
}

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'email' | 'regex' | 'range';
  value?: any;
  message?: string;
}

export interface UIComponent {
  name: string;
  type: 'page' | 'component' | 'layout';
  description: string;
  props: Parameter[];
  children: UIComponent[];
  styling: string[];
  functionality: string[];
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  conditions: string[];
  actions: string[];
  priority: number;
}

export interface GeneratedApp {
  id: string;
  name: string;
  specification: RequirementSpec;
  files: GeneratedFile[];
  status: AppStatus;
  created_at: Date;
  last_updated: Date;
  health: HealthStatus;
  metrics: AppMetrics;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'typescript' | 'javascript' | 'css' | 'html' | 'json' | 'markdown' | 'config';
  lastModified: Date;
  size: number;
}

export interface AppStatus {
  phase: 'generating' | 'testing' | 'deploying' | 'running' | 'error' | 'healing';
  progress: number;
  message: string;
  errors: ErrorInfo[];
}

export interface ErrorInfo {
  id: string;
  type: 'syntax' | 'runtime' | 'performance' | 'security' | 'ux';
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  line: number;
  message: string;
  fix_attempted: boolean;
  fix_successful: boolean;
  timestamp: Date;
}

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  uptime: number;
  performance: PerformanceMetrics;
  errors: ErrorInfo[];
  lastCheck: Date;
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
}

export interface AppMetrics {
  users: UserMetrics;
  performance: PerformanceMetrics;
  business: BusinessMetrics;
  technical: TechnicalMetrics;
}

export interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  userSessions: number;
  bounceRate: number;
  conversionRate: number;
}

export interface BusinessMetrics {
  revenue: number;
  transactions: number;
  customerSatisfaction: number;
  goalCompletions: number;
}

export interface TechnicalMetrics {
  deployments: number;
  bugsFixed: number;
  testsRun: number;
  codeQuality: number;
  securityScore: number;
}

export interface TestSuite {
  id: string;
  name: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  tests: TestCase[];
  status: 'pending' | 'running' | 'passed' | 'failed';
  coverage: number;
  duration: number;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshots?: string[];
}

export interface Fix {
  id: string;
  error_id: string;
  type: 'code' | 'config' | 'dependency' | 'infrastructure';
  description: string;
  changes: FileChange[];
  confidence: number;
  tested: boolean;
  applied: boolean;
  rollback_info: RollbackInfo;
}

export interface FileChange {
  file: string;
  type: 'create' | 'update' | 'delete';
  original_content?: string;
  new_content?: string;
}

export interface RollbackInfo {
  backup_id: string;
  timestamp: Date;
  files: string[];
}

export interface DeploymentResult {
  id: string;
  app_id: string;
  environment: string;
  status: 'pending' | 'deploying' | 'success' | 'failed' | 'rolled_back';
  url?: string;
  logs: string[];
  duration: number;
  timestamp: Date;
}

export interface AIAnalysisResult {
  confidence: number;
  recommendations: string[];
  code_quality: number;
  security_score: number;
  performance_score: number;
  maintainability: number;
  suggestions: Suggestion[];
}

export interface Suggestion {
  type: 'optimization' | 'refactor' | 'security' | 'performance' | 'best_practice';
  priority: 'low' | 'medium' | 'high';
  description: string;
  file?: string;
  line?: number;
  fix?: string;
}

export interface FrameworkEvents {
  'app:created': { app: GeneratedApp };
  'app:updated': { app: GeneratedApp };
  'app:deployed': { app: GeneratedApp; deployment: DeploymentResult };
  'app:error': { app: GeneratedApp; error: ErrorInfo };
  'app:fixed': { app: GeneratedApp; fix: Fix };
  'test:started': { app: GeneratedApp; suite: TestSuite };
  'test:completed': { app: GeneratedApp; suite: TestSuite };
  'deployment:started': { app: GeneratedApp };
  'deployment:completed': { app: GeneratedApp; result: DeploymentResult };
  'monitoring:alert': { app: GeneratedApp; alert: Alert };
}

export interface Alert {
  id: string;
  type: 'error' | 'performance' | 'security' | 'availability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  app_id: string;
  timestamp: Date;
  resolved: boolean;
}
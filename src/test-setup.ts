import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Increase test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Global test utilities
global.testUtils = {
  createMockConfig: () => ({
    aiProvider: 'openai' as const,
    apiKeys: {
      openai: 'test-key'
    },
    database: {
      type: 'sqlite' as const,
      database: ':memory:'
    },
    deployment: {
      provider: 'docker' as const,
      environment: 'development' as const,
      autoScale: false,
      healthChecks: true,
      rollbackOnFailure: true
    },
    monitoring: {
      enableRealTime: false,
      errorTracking: false,
      performanceMetrics: false,
      userAnalytics: false,
      alertWebhooks: []
    },
    testing: {
      unitTests: true,
      integrationTests: false,
      e2eTests: false,
      visualRegression: false,
      performanceTesting: false,
      accessibility: false,
      autoFix: false
    },
    healing: {
      autoFix: false,
      retryAttempts: 1,
      rollbackThreshold: 1,
      learningMode: false,
      notifyOnFix: false
    },
    workspaceDir: './test-workspace',
    logLevel: 'error' as const
  }),

  createMockLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setLevel: jest.fn(),
    createChildLogger: jest.fn()
  }),

  createMockApp: () => ({
    id: 'test-app-id',
    name: 'Test Application',
    specification: {
      id: 'test-spec-id',
      title: 'Test Application',
      description: 'A test application',
      features: [
        {
          id: 'feature-1',
          name: 'User Authentication',
          description: 'User login and registration',
          priority: 'high' as const,
          complexity: 'moderate' as const,
          dependencies: [],
          acceptance_criteria: ['Users can register', 'Users can login']
        }
      ],
      techStack: {
        frontend: {
          framework: 'react' as const,
          styling: 'tailwind' as const,
          stateManagement: 'zustand' as const,
          typescript: true
        },
        backend: {
          framework: 'express' as const,
          language: 'typescript' as const,
          authentication: 'jwt' as const
        },
        database: {
          type: 'postgresql' as const,
          database: 'test_db'
        },
        testing: ['jest'],
        deployment: ['docker']
      },
      authentication: true,
      database: true,
      realtime: false,
      fileUploads: false,
      notifications: false,
      mobileSupport: true,
      apiEndpoints: [],
      uiComponents: [],
      businessLogic: []
    },
    files: [],
    status: {
      phase: 'running' as const,
      progress: 100,
      message: 'Application ready',
      errors: []
    },
    created_at: new Date(),
    last_updated: new Date(),
    health: {
      overall: 'healthy' as const,
      uptime: 0,
      performance: {
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0
      },
      errors: [],
      lastCheck: new Date()
    },
    metrics: {
      users: {
        totalUsers: 0,
        activeUsers: 0,
        userSessions: 0,
        bounceRate: 0,
        conversionRate: 0
      },
      performance: {
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0
      },
      business: {
        revenue: 0,
        transactions: 0,
        customerSatisfaction: 0,
        goalCompletions: 0
      },
      technical: {
        deployments: 0,
        bugsFixed: 0,
        testsRun: 0,
        codeQuality: 0,
        securityScore: 0
      }
    }
  }),

  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Type declarations for test utilities
declare global {
  var testUtils: {
    createMockConfig: () => any;
    createMockLogger: () => any;
    createMockApp: () => any;
    wait: (ms: number) => Promise<void>;
  };
}
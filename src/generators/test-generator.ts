import path from 'path';
import fs from 'fs-extra';
import { RequirementSpec, GeneratedFile, FrameworkConfig } from '../types';
import { Logger } from '../utils/logger';

export class TestGenerator {
  private logger: Logger;
  private config: FrameworkConfig;

  constructor(config: FrameworkConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async generate(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    this.logger.info('Generating test configurations and setup files...');
    
    const files: GeneratedFile[] = [];

    files.push(...await this.generateJestConfig(spec, outputDir));
    files.push(...await this.generatePlaywrightConfig(spec, outputDir));
    files.push(...await this.generateTestSetup(spec, outputDir));

    return files;
  }

  private async generateJestConfig(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Frontend Jest config
    const frontendJestConfig = `module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\\\.(css|less|scss)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.(ts|tsx)',
    '<rootDir>/src/**/*.(test|spec).(ts|tsx)',
  ],
  collectCoverageFrom: [
    'src/**/*.(ts|tsx)',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
`;

    const frontendJestPath = path.join(outputDir, 'frontend', 'jest.config.js');
    await fs.ensureDir(path.dirname(frontendJestPath));
    await fs.writeFile(frontendJestPath, frontendJestConfig);
    files.push({
      path: 'frontend/jest.config.js',
      content: frontendJestConfig,
      type: 'javascript',
      lastModified: new Date(),
      size: frontendJestConfig.length
    });

    // Backend Jest config
    const backendJestConfig = `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.ts',
    '<rootDir>/src/**/*.(test|spec).ts',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testTimeout: 10000,
};
`;

    const backendJestPath = path.join(outputDir, 'backend', 'jest.config.js');
    await fs.ensureDir(path.dirname(backendJestPath));
    await fs.writeFile(backendJestPath, backendJestConfig);
    files.push({
      path: 'backend/jest.config.js',
      content: backendJestConfig,
      type: 'javascript',
      lastModified: new Date(),
      size: backendJestConfig.length
    });

    return files;
  }

  private async generatePlaywrightConfig(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const playwrightConfig = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
`;

    const playwrightConfigPath = path.join(outputDir, 'playwright.config.ts');
    await fs.writeFile(playwrightConfigPath, playwrightConfig);
    files.push({
      path: 'playwright.config.ts',
      content: playwrightConfig,
      type: 'typescript',
      lastModified: new Date(),
      size: playwrightConfig.length
    });

    // Generate sample E2E tests
    const e2eTestsDir = path.join(outputDir, 'tests', 'e2e');
    await fs.ensureDir(e2eTestsDir);

    // Home page test
    const homeTest = `import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the main heading', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.getByRole('heading', { name: /welcome to ${spec.title}/i })).toBeVisible();
    await expect(page.getByText('${spec.description}')).toBeVisible();
  });

  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/');
    
    await expect(page).toHaveTitle(/${spec.title}/);
    
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', '${spec.description}');
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  });
});
`;

    const homeTestPath = path.join(e2eTestsDir, 'home.spec.ts');
    await fs.writeFile(homeTestPath, homeTest);
    files.push({
      path: 'tests/e2e/home.spec.ts',
      content: homeTest,
      type: 'typescript',
      lastModified: new Date(),
      size: homeTest.length
    });

    if (spec.authentication) {
      const authTest = `import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Login', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');
      
      await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/login');
      
      await page.getByRole('button', { name: /login/i }).click();
      
      await expect(page.getByText(/email is required/i)).toBeVisible();
      await expect(page.getByText(/password is required/i)).toBeVisible();
    });

    test('should login with valid credentials', async ({ page }) => {
      await page.goto('/login');
      
      await page.getByLabel(/email/i).fill('demo@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /login/i }).click();
      
      // Should redirect to home page
      await expect(page).toHaveURL('/');
      
      // Should show user menu
      await expect(page.getByText(/welcome/i)).toBeVisible();
    });
  });

  test.describe('Registration', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register');
      
      await expect(page.getByRole('heading', { name: /register/i })).toBeVisible();
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    });

    test('should validate password confirmation', async ({ page }) => {
      await page.goto('/register');
      
      await page.getByLabel(/name/i).fill('Test User');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByLabel(/confirm password/i).fill('different');
      
      await page.getByRole('button', { name: /register/i }).click();
      
      await expect(page.getByText(/passwords do not match/i)).toBeVisible();
    });
  });
});
`;

      const authTestPath = path.join(e2eTestsDir, 'auth.spec.ts');
      await fs.writeFile(authTestPath, authTest);
      files.push({
        path: 'tests/e2e/auth.spec.ts',
        content: authTest,
        type: 'typescript',
        lastModified: new Date(),
        size: authTest.length
      });
    }

    return files;
  }

  private async generateTestSetup(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Frontend test setup
    const frontendTestSetup = `import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure testing library
configure({ testIdAttribute: 'data-testid' });

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));

${spec.authentication ? `
// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;
` : ''}

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
`;

    const frontendTestSetupPath = path.join(outputDir, 'frontend', 'src', 'test-setup.ts');
    await fs.ensureDir(path.dirname(frontendTestSetupPath));
    await fs.writeFile(frontendTestSetupPath, frontendTestSetup);
    files.push({
      path: 'frontend/src/test-setup.ts',
      content: frontendTestSetup,
      type: 'typescript',
      lastModified: new Date(),
      size: frontendTestSetup.length
    });

    // Backend test setup
    const backendTestSetup = `import { config } from '../config';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

${spec.database ? `
// Mock database connection for tests
jest.mock('../utils/database', () => ({
  database: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  },
  connectDatabase: jest.fn(),
  closeDatabaseConnection: jest.fn(),
}));
` : ''}

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test helpers
global.testHelpers = {
  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides,
  }),
  createMockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };
    return res;
  },
  createMockNext: () => jest.fn(),
};

// Type declarations for test helpers
declare global {
  var testHelpers: {
    createMockRequest: (overrides?: any) => any;
    createMockResponse: () => any;
    createMockNext: () => jest.Mock;
  };
}
`;

    const backendTestSetupPath = path.join(outputDir, 'backend', 'src', 'test-setup.ts');
    await fs.ensureDir(path.dirname(backendTestSetupPath));
    await fs.writeFile(backendTestSetupPath, backendTestSetup);
    files.push({
      path: 'backend/src/test-setup.ts',
      content: backendTestSetup,
      type: 'typescript',
      lastModified: new Date(),
      size: backendTestSetup.length
    });

    // GitHub Actions workflow for testing
    const githubWorkflow = `name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      ${spec.database && spec.techStack.database.type === 'postgresql' ? `
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: password
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432` : ''}

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - uses: actions/checkout@v4

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: |
        npm ci
        cd frontend && npm ci
        cd ../backend && npm ci
        cd ..

    - name: Run linting
      run: |
        cd frontend && npm run lint
        cd ../backend && npm run lint

    - name: Run unit tests
      run: |
        cd frontend && npm run test:coverage
        cd ../backend && npm run test:coverage
      env:
        NODE_ENV: test
        JWT_SECRET: test-jwt-secret
        ${spec.database && spec.techStack.database.type === 'postgresql' ? `
        DATABASE_URL: postgresql://postgres:password@localhost:5432/test_db` : ''}

    - name: Install Playwright browsers
      run: npx playwright install

    - name: Run E2E tests
      run: npx playwright test
      env:
        CI: true

    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        token: ${{ secrets.CODECOV_TOKEN }}
        directory: ./coverage
        flags: unittests
        name: codecov-umbrella

    - name: Upload test results
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: test-results-${{ matrix.node-version }}
        path: |
          frontend/coverage/
          backend/coverage/
          playwright-report/
          test-results/
        retention-days: 30
`;

    const githubWorkflowPath = path.join(outputDir, '.github', 'workflows', 'tests.yml');
    await fs.ensureDir(path.dirname(githubWorkflowPath));
    await fs.writeFile(githubWorkflowPath, githubWorkflow);
    files.push({
      path: '.github/workflows/tests.yml',
      content: githubWorkflow,
      type: 'config',
      lastModified: new Date(),
      size: githubWorkflow.length
    });

    return files;
  }
}
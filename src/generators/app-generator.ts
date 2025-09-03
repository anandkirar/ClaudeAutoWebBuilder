import path from 'path';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  RequirementSpec, 
  GeneratedApp, 
  GeneratedFile, 
  AppStatus,
  FrameworkConfig 
} from '../types';
import { Logger } from '../utils/logger';
import { ReactGenerator } from './react-generator';
import { NodeBackendGenerator } from './node-backend-generator';
import { DatabaseGenerator } from './database-generator';
import { TestGenerator } from './test-generator';
import { DockerGenerator } from './docker-generator';

const execAsync = promisify(exec);

export class AppGenerator {
  private logger: Logger;
  private config: FrameworkConfig;
  private reactGenerator: ReactGenerator;
  private backendGenerator: NodeBackendGenerator;
  private databaseGenerator: DatabaseGenerator;
  private testGenerator: TestGenerator;
  private dockerGenerator: DockerGenerator;

  constructor(config: FrameworkConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    this.reactGenerator = new ReactGenerator(config, logger);
    this.backendGenerator = new NodeBackendGenerator(config, logger);
    this.databaseGenerator = new DatabaseGenerator(config, logger);
    this.testGenerator = new TestGenerator(config, logger);
    this.dockerGenerator = new DockerGenerator(config, logger);
  }

  async generate(spec: RequirementSpec): Promise<GeneratedApp> {
    const appId = uuidv4();
    const appDir = path.join(this.config.workspaceDir, 'apps', appId);
    
    this.logger.info(`Generating app: ${spec.title} (${appId})`);
    
    try {
      await fs.ensureDir(appDir);
      
      const app: GeneratedApp = {
        id: appId,
        name: spec.title,
        specification: spec,
        files: [],
        status: {
          phase: 'generating',
          progress: 0,
          message: 'Starting code generation...',
          errors: []
        },
        created_at: new Date(),
        last_updated: new Date(),
        health: {
          overall: 'healthy',
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
      };

      const files = await this.generateAllFiles(spec, appDir, app);
      app.files = files;
      
      await this.setupProject(appDir, spec, app);
      
      app.status = {
        phase: 'testing',
        progress: 90,
        message: 'Code generation completed, running initial tests...',
        errors: []
      };
      
      await this.saveAppManifest(appDir, app);
      
      app.status = {
        phase: 'running',
        progress: 100,
        message: 'Application generated successfully',
        errors: []
      };
      
      this.logger.info(`App generation completed: ${spec.title}`);
      return app;
      
    } catch (error) {
      this.logger.error(`App generation failed for ${spec.title}:`, error);
      
      const failedApp: GeneratedApp = {
        ...{} as GeneratedApp,
        id: appId,
        name: spec.title,
        specification: spec,
        files: [],
        status: {
          phase: 'error',
          progress: 0,
          message: `Generation failed: ${error.message}`,
          errors: [{
            id: uuidv4(),
            type: 'runtime',
            severity: 'critical',
            file: 'generator',
            line: 0,
            message: error.message,
            fix_attempted: false,
            fix_successful: false,
            timestamp: new Date()
          }]
        },
        created_at: new Date(),
        last_updated: new Date(),
        health: {} as any,
        metrics: {} as any
      };
      
      throw new Error(`App generation failed: ${error.message}`);
    }
  }

  private async generateAllFiles(spec: RequirementSpec, appDir: string, app: GeneratedApp): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    
    this.updateProgress(app, 10, 'Generating project structure...');
    files.push(...await this.generateProjectStructure(spec, appDir));
    
    this.updateProgress(app, 30, 'Generating frontend code...');
    files.push(...await this.reactGenerator.generate(spec, path.join(appDir, 'frontend')));
    
    this.updateProgress(app, 50, 'Generating backend code...');
    files.push(...await this.backendGenerator.generate(spec, path.join(appDir, 'backend')));
    
    if (spec.database) {
      this.updateProgress(app, 60, 'Generating database schema...');
      files.push(...await this.databaseGenerator.generate(spec, path.join(appDir, 'database')));
    }
    
    this.updateProgress(app, 70, 'Generating tests...');
    files.push(...await this.testGenerator.generate(spec, appDir));
    
    this.updateProgress(app, 80, 'Generating deployment files...');
    files.push(...await this.dockerGenerator.generate(spec, appDir));
    files.push(...await this.generateDeploymentFiles(spec, appDir));
    
    return files;
  }

  private updateProgress(app: GeneratedApp, progress: number, message: string): void {
    app.status.progress = progress;
    app.status.message = message;
    app.last_updated = new Date();
  }

  private async generateProjectStructure(spec: RequirementSpec, appDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    
    const packageJson = {
      name: spec.title.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: spec.description,
      scripts: {
        dev: 'concurrently "npm run dev:backend" "npm run dev:frontend"',
        'dev:frontend': 'cd frontend && npm run dev',
        'dev:backend': 'cd backend && npm run dev',
        build: 'npm run build:frontend && npm run build:backend',
        'build:frontend': 'cd frontend && npm run build',
        'build:backend': 'cd backend && npm run build',
        start: 'cd backend && npm start',
        test: 'npm run test:frontend && npm run test:backend',
        'test:frontend': 'cd frontend && npm test',
        'test:backend': 'cd backend && npm test',
        'docker:build': 'docker-compose build',
        'docker:up': 'docker-compose up -d',
        'docker:down': 'docker-compose down',
        deploy: 'npm run build && npm run docker:build'
      },
      devDependencies: {
        concurrently: '^8.2.2'
      }
    };

    const packageJsonPath = path.join(appDir, 'package.json');
    await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
    files.push({
      path: 'package.json',
      content: JSON.stringify(packageJson, null, 2),
      type: 'json',
      lastModified: new Date(),
      size: JSON.stringify(packageJson).length
    });

    const readme = this.generateReadme(spec);
    const readmePath = path.join(appDir, 'README.md');
    await fs.writeFile(readmePath, readme);
    files.push({
      path: 'README.md',
      content: readme,
      type: 'markdown',
      lastModified: new Date(),
      size: readme.length
    });

    const gitignore = this.generateGitignore();
    const gitignorePath = path.join(appDir, '.gitignore');
    await fs.writeFile(gitignorePath, gitignore);
    files.push({
      path: '.gitignore',
      content: gitignore,
      type: 'config',
      lastModified: new Date(),
      size: gitignore.length
    });

    const eslintConfig = this.generateESLintConfig();
    const eslintPath = path.join(appDir, '.eslintrc.js');
    await fs.writeFile(eslintPath, eslintConfig);
    files.push({
      path: '.eslintrc.js',
      content: eslintConfig,
      type: 'javascript',
      lastModified: new Date(),
      size: eslintConfig.length
    });

    const prettierConfig = this.generatePrettierConfig();
    const prettierPath = path.join(appDir, '.prettierrc');
    await fs.writeFile(prettierPath, prettierConfig);
    files.push({
      path: '.prettierrc',
      content: prettierConfig,
      type: 'json',
      lastModified: new Date(),
      size: prettierConfig.length
    });

    const envExample = this.generateEnvExample(spec);
    const envExamplePath = path.join(appDir, '.env.example');
    await fs.writeFile(envExamplePath, envExample);
    files.push({
      path: '.env.example',
      content: envExample,
      type: 'config',
      lastModified: new Date(),
      size: envExample.length
    });

    return files;
  }

  private generateReadme(spec: RequirementSpec): string {
    return `# ${spec.title}

${spec.description}

## Features

${spec.features.map(f => `- ${f.name}: ${f.description}`).join('\n')}

## Tech Stack

### Frontend
- Framework: ${spec.techStack.frontend.framework}
- Styling: ${spec.techStack.frontend.styling}
- State Management: ${spec.techStack.frontend.stateManagement}
- TypeScript: ${spec.techStack.frontend.typescript ? 'Yes' : 'No'}

### Backend
- Framework: ${spec.techStack.backend.framework}
- Language: ${spec.techStack.backend.language}
- Authentication: ${spec.techStack.backend.authentication}

### Database
- Type: ${spec.techStack.database.type}
- Database: ${spec.techStack.database.database}

## Getting Started

### Prerequisites
- Node.js 18+
- Docker (optional)
- ${spec.techStack.database.type === 'postgresql' ? 'PostgreSQL' : 
     spec.techStack.database.type === 'mongodb' ? 'MongoDB' : 'SQLite'}

### Installation

1. Clone the repository
\`\`\`bash
git clone <repository-url>
cd ${spec.title.toLowerCase().replace(/\s+/g, '-')}
\`\`\`

2. Install dependencies
\`\`\`bash
npm install
cd frontend && npm install
cd ../backend && npm install
cd ..
\`\`\`

3. Set up environment variables
\`\`\`bash
cp .env.example .env
# Edit .env with your configuration
\`\`\`

4. Start the development server
\`\`\`bash
npm run dev
\`\`\`

### Using Docker

1. Build and start the containers
\`\`\`bash
npm run docker:up
\`\`\`

2. Stop the containers
\`\`\`bash
npm run docker:down
\`\`\`

## API Documentation

${spec.apiEndpoints.map(endpoint => `
### ${endpoint.method} ${endpoint.path}
${endpoint.description}

**Parameters:**
${endpoint.parameters.map(p => `- ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`).join('\n')}

**Response:** ${endpoint.response.status_codes.join(', ')}
`).join('\n')}

## Testing

Run tests:
\`\`\`bash
npm test
\`\`\`

Run frontend tests:
\`\`\`bash
npm run test:frontend
\`\`\`

Run backend tests:
\`\`\`bash
npm run test:backend
\`\`\`

## Deployment

1. Build the application
\`\`\`bash
npm run build
\`\`\`

2. Deploy using Docker
\`\`\`bash
npm run deploy
\`\`\`

## License

MIT License - Generated by Autonomous Web Framework
`;
  }

  private generateGitignore(): string {
    return `# Dependencies
node_modules/
*/node_modules/

# Build outputs
dist/
build/
*/dist/
*/build/

# Environment variables
.env
.env.local
.env.development
.env.test
.env.production

# Logs
*.log
logs/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# NYC test coverage
.nyc_output/

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Docker
docker-compose.override.yml

# Database
*.sqlite
*.db

# Backup files
backup/
*.backup
`;
  }

  private generateESLintConfig(): string {
    return `module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    'no-console': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    'prefer-const': 'error',
  },
  ignorePatterns: ['dist/', 'build/', 'node_modules/'],
};
`;
  }

  private generatePrettierConfig(): string {
    return JSON.stringify({
      semi: true,
      trailingComma: 'es5',
      singleQuote: true,
      printWidth: 100,
      tabWidth: 2,
      useTabs: false
    }, null, 2);
  }

  private generateEnvExample(spec: RequirementSpec): string {
    let env = `# Application Configuration
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001

# API Keys
${this.config.aiProvider.toUpperCase()}_API_KEY=your-api-key-here

`;

    if (spec.database) {
      if (spec.techStack.database.type === 'postgresql') {
        env += `# Database (PostgreSQL)
DATABASE_URL=postgresql://username:password@localhost:5432/${spec.techStack.database.database}
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${spec.techStack.database.database}
DB_USER=username
DB_PASSWORD=password

`;
      } else if (spec.techStack.database.type === 'mongodb') {
        env += `# Database (MongoDB)
DATABASE_URL=mongodb://localhost:27017/${spec.techStack.database.database}
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_DATABASE=${spec.techStack.database.database}

`;
      }
    }

    if (spec.authentication) {
      env += `# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

`;
    }

    if (spec.notifications) {
      env += `# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-email-password

`;
    }

    if (spec.fileUploads) {
      env += `# File Upload Configuration
UPLOAD_MAX_SIZE=10MB
UPLOAD_ALLOWED_TYPES=jpg,jpeg,png,gif,pdf,doc,docx

`;
    }

    return env;
  }

  private async generateDeploymentFiles(spec: RequirementSpec, appDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const dockerCompose = this.generateDockerCompose(spec);
    const dockerComposePath = path.join(appDir, 'docker-compose.yml');
    await fs.writeFile(dockerComposePath, dockerCompose);
    files.push({
      path: 'docker-compose.yml',
      content: dockerCompose,
      type: 'config',
      lastModified: new Date(),
      size: dockerCompose.length
    });

    const nginx = this.generateNginxConfig(spec);
    const nginxDir = path.join(appDir, 'nginx');
    await fs.ensureDir(nginxDir);
    const nginxPath = path.join(nginxDir, 'nginx.conf');
    await fs.writeFile(nginxPath, nginx);
    files.push({
      path: 'nginx/nginx.conf',
      content: nginx,
      type: 'config',
      lastModified: new Date(),
      size: nginx.length
    });

    return files;
  }

  private generateDockerCompose(spec: RequirementSpec): string {
    let compose = `version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:3001
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
`;

    if (spec.database) {
      compose += `    depends_on:
      - database
`;
    }

    if (spec.database) {
      if (spec.techStack.database.type === 'postgresql') {
        compose += `
  database:
    image: postgres:15
    environment:
      POSTGRES_DB: ${spec.techStack.database.database}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`;
      } else if (spec.techStack.database.type === 'mongodb') {
        compose += `
  database:
    image: mongo:6
    environment:
      MONGO_INITDB_DATABASE: ${spec.techStack.database.database}
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
`;
      }
    }

    compose += `
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - frontend
      - backend
`;

    return compose;
  }

  private generateNginxConfig(spec: RequirementSpec): string {
    return `events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:3001;
    }

    server {
        listen 80;
        server_name localhost;

        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
`;
  }

  private async setupProject(appDir: string, spec: RequirementSpec, app: GeneratedApp): Promise<void> {
    try {
      this.updateProgress(app, 85, 'Installing dependencies...');
      
      const frontendDir = path.join(appDir, 'frontend');
      const backendDir = path.join(appDir, 'backend');
      
      if (await fs.pathExists(frontendDir)) {
        await execAsync('npm install', { cwd: frontendDir });
      }
      
      if (await fs.pathExists(backendDir)) {
        await execAsync('npm install', { cwd: backendDir });
      }
      
      this.updateProgress(app, 88, 'Setting up git repository...');
      await execAsync('git init', { cwd: appDir });
      await execAsync('git add .', { cwd: appDir });
      await execAsync('git commit -m "Initial commit: Generated by Autonomous Web Framework"', { cwd: appDir });
      
    } catch (error) {
      this.logger.warn('Project setup partially failed:', error);
    }
  }

  private async saveAppManifest(appDir: string, app: GeneratedApp): Promise<void> {
    const manifestPath = path.join(appDir, 'app-manifest.json');
    await fs.writeJSON(manifestPath, app, { spaces: 2 });
  }
}
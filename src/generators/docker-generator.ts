import path from 'path';
import fs from 'fs-extra';
import { RequirementSpec, GeneratedFile, FrameworkConfig } from '../types';
import { Logger } from '../utils/logger';

export class DockerGenerator {
  private logger: Logger;
  private config: FrameworkConfig;

  constructor(config: FrameworkConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async generate(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    this.logger.info('Generating Docker configurations...');
    
    const files: GeneratedFile[] = [];

    files.push(...await this.generateFrontendDockerfile(spec, outputDir));
    files.push(...await this.generateBackendDockerfile(spec, outputDir));
    files.push(...await this.generateDockerCompose(spec, outputDir));
    files.push(...await this.generateDockerIgnore(spec, outputDir));

    return files;
  }

  private async generateFrontendDockerfile(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const dockerfile = `# Frontend Dockerfile for ${spec.title}
# Multi-stage build for React application

# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
`;

    const dockerfilePath = path.join(outputDir, 'frontend', 'Dockerfile');
    await fs.ensureDir(path.dirname(dockerfilePath));
    await fs.writeFile(dockerfilePath, dockerfile);
    files.push({
      path: 'frontend/Dockerfile',
      content: dockerfile,
      type: 'config',
      lastModified: new Date(),
      size: dockerfile.length
    });

    // Nginx configuration for React app
    const nginxConfig = `events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/json
        application/xml+rss;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Referrer-Policy strict-origin-when-cross-origin;

        # Handle React Router
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Cache static assets
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # API proxy (if needed for development)
        location /api/ {
            proxy_pass http://backend:3001;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\\n";
            add_header Content-Type text/plain;
        }
    }
}
`;

    const nginxConfigPath = path.join(outputDir, 'frontend', 'nginx.conf');
    await fs.writeFile(nginxConfigPath, nginxConfig);
    files.push({
      path: 'frontend/nginx.conf',
      content: nginxConfig,
      type: 'config',
      lastModified: new Date(),
      size: nginxConfig.length
    });

    return files;
  }

  private async generateBackendDockerfile(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const dockerfile = `# Backend Dockerfile for ${spec.title}
# Multi-stage build for Node.js application

# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including dev dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=backend:nodejs /app/dist ./dist

${spec.fileUploads ? `
# Create uploads directory
RUN mkdir -p uploads && chown backend:nodejs uploads
` : ''}

# Switch to non-root user
USER backend

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { \\
    process.exit(res.statusCode === 200 ? 0 : 1) \\
  }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/server.js"]
`;

    const dockerfilePath = path.join(outputDir, 'backend', 'Dockerfile');
    await fs.ensureDir(path.dirname(dockerfilePath));
    await fs.writeFile(dockerfilePath, dockerfile);
    files.push({
      path: 'backend/Dockerfile',
      content: dockerfile,
      type: 'config',
      lastModified: new Date(),
      size: dockerfile.length
    });

    return files;
  }

  private async generateDockerCompose(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Development compose file
    const devCompose = `version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
      target: development
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - REACT_APP_API_URL=http://localhost:3001
    depends_on:
      - backend
    command: npm run dev

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
      target: development
    ports:
      - "3001:3001"
    volumes:
      - ./backend:/app
      - /app/node_modules
      ${spec.fileUploads ? `- uploads:/app/uploads` : ''}
    environment:
      - NODE_ENV=development
      - PORT=3001
      - JWT_SECRET=dev-jwt-secret-change-in-production
      ${spec.database && spec.techStack.database.type === 'postgresql' ? `- DATABASE_URL=postgresql://postgres:password@postgres:5432/${spec.techStack.database.database}` : ''}
      ${spec.database && spec.techStack.database.type === 'mongodb' ? `- DATABASE_URL=mongodb://mongo:27017/${spec.techStack.database.database}` : ''}
    depends_on:
      ${spec.database ? `- database` : ''}
    command: npm run dev

${spec.database ? this.generateDatabaseService(spec) : ''}

  # Redis for caching (optional)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  ${spec.database && spec.techStack.database.type === 'postgresql' ? 'postgres_data:' : ''}
  ${spec.database && spec.techStack.database.type === 'mongodb' ? 'mongo_data:' : ''}
  redis_data:
  ${spec.fileUploads ? 'uploads:' : ''}

networks:
  default:
    name: ${spec.title.toLowerCase().replace(/\s+/g, '-')}-network
`;

    const devComposePath = path.join(outputDir, 'docker-compose.dev.yml');
    await fs.writeFile(devComposePath, devCompose);
    files.push({
      path: 'docker-compose.dev.yml',
      content: devCompose,
      type: 'config',
      lastModified: new Date(),
      size: devCompose.length
    });

    // Production compose file
    const prodCompose = `version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - web
      - internal

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    expose:
      - "3001"
    volumes:
      ${spec.fileUploads ? `- uploads:/app/uploads` : ''}
    environment:
      - NODE_ENV=production
      - PORT=3001
      - JWT_SECRET=\${JWT_SECRET}
      ${spec.database && spec.techStack.database.type === 'postgresql' ? `- DATABASE_URL=\${DATABASE_URL}` : ''}
      ${spec.database && spec.techStack.database.type === 'mongodb' ? `- DATABASE_URL=\${DATABASE_URL}` : ''}
    depends_on:
      ${spec.database ? `- database` : ''}
    networks:
      - internal
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3

${spec.database ? this.generateDatabaseService(spec, true) : ''}

  # Nginx reverse proxy
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    networks:
      - web
      - internal

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    restart: unless-stopped
    ports:
      - "3100:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=\${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - monitoring

volumes:
  ${spec.database && spec.techStack.database.type === 'postgresql' ? 'postgres_data:' : ''}
  ${spec.database && spec.techStack.database.type === 'mongodb' ? 'mongo_data:' : ''}
  prometheus_data:
  grafana_data:
  ${spec.fileUploads ? 'uploads:' : ''}

networks:
  web:
    external: true
  internal:
  monitoring:
`;

    const prodComposePath = path.join(outputDir, 'docker-compose.prod.yml');
    await fs.writeFile(prodComposePath, prodCompose);
    files.push({
      path: 'docker-compose.prod.yml',
      content: prodCompose,
      type: 'config',
      lastModified: new Date(),
      size: prodCompose.length
    });

    // Environment file template
    const envTemplate = `# Production Environment Variables
# Copy this file to .env and update with your values

# Application
NODE_ENV=production
JWT_SECRET=your-super-secure-jwt-secret-here

# Database
${spec.database && spec.techStack.database.type === 'postgresql' ? `
DATABASE_URL=postgresql://username:password@database:5432/${spec.techStack.database.database}
POSTGRES_USER=username
POSTGRES_PASSWORD=password
POSTGRES_DB=${spec.techStack.database.database}` : ''}
${spec.database && spec.techStack.database.type === 'mongodb' ? `
DATABASE_URL=mongodb://database:27017/${spec.techStack.database.database}
MONGO_INITDB_DATABASE=${spec.techStack.database.database}` : ''}

${spec.notifications ? `
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
` : ''}

# Monitoring
GRAFANA_PASSWORD=your-grafana-password

# SSL (if using HTTPS)
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/key.pem
`;

    const envTemplatePath = path.join(outputDir, '.env.example');
    await fs.writeFile(envTemplatePath, envTemplate);
    files.push({
      path: '.env.example',
      content: envTemplate,
      type: 'config',
      lastModified: new Date(),
      size: envTemplate.length
    });

    return files;
  }

  private generateDatabaseService(spec: RequirementSpec, production = false): string {
    if (spec.techStack.database.type === 'postgresql') {
      return `  database:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_DB=${production ? '${POSTGRES_DB}' : spec.techStack.database.database}
      - POSTGRES_USER=${production ? '${POSTGRES_USER}' : 'postgres'}
      - POSTGRES_PASSWORD=${production ? '${POSTGRES_PASSWORD}' : 'password'}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      ${!production ? `- ./database/migrations:/docker-entrypoint-initdb.d` : ''}
    ${!production ? 'ports:\n      - "5432:5432"' : ''}
    networks:
      - internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${production ? '${POSTGRES_USER}' : 'postgres'}"]
      interval: 10s
      timeout: 5s
      retries: 5
`;
    }

    if (spec.techStack.database.type === 'mongodb') {
      return `  database:
    image: mongo:6-alpine
    restart: unless-stopped
    environment:
      - MONGO_INITDB_DATABASE=${production ? '${MONGO_INITDB_DATABASE}' : spec.techStack.database.database}
    volumes:
      - mongo_data:/data/db
    ${!production ? 'ports:\n      - "27017:27017"' : ''}
    networks:
      - internal
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5
`;
    }

    return '';
  }

  private async generateDockerIgnore(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const frontendDockerIgnore = `node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.git
.gitignore
README.md
.env
.env.local
.env.development
.env.test
.env.production
.nyc_output
coverage
.vscode
.idea
*.swp
*.swo
dist
build
`;

    const frontendDockerIgnorePath = path.join(outputDir, 'frontend', '.dockerignore');
    await fs.ensureDir(path.dirname(frontendDockerIgnorePath));
    await fs.writeFile(frontendDockerIgnorePath, frontendDockerIgnore);
    files.push({
      path: 'frontend/.dockerignore',
      content: frontendDockerIgnore,
      type: 'config',
      lastModified: new Date(),
      size: frontendDockerIgnore.length
    });

    const backendDockerIgnore = `node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.git
.gitignore
README.md
.env
.env.local
.env.development
.env.test
.env.production
.nyc_output
coverage
.vscode
.idea
*.swp
*.swo
dist
uploads
logs
`;

    const backendDockerIgnorePath = path.join(outputDir, 'backend', '.dockerignore');
    await fs.ensureDir(path.dirname(backendDockerIgnorePath));
    await fs.writeFile(backendDockerIgnorePath, backendDockerIgnore);
    files.push({
      path: 'backend/.dockerignore',
      content: backendDockerIgnore,
      type: 'config',
      lastModified: new Date(),
      size: backendDockerIgnore.length
    });

    return files;
  }
}
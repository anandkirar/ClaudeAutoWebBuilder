#!/usr/bin/env node

/**
 * Build Script: Template Generation
 * 
 * This script generates code templates and configuration files
 * used by the framework's code generation system.
 */

const fs = require('fs-extra');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'src', 'templates');

async function buildTemplates() {
  console.log('🏗️  Building framework templates...');

  try {
    // Ensure templates directory exists
    await fs.ensureDir(TEMPLATES_DIR);

    // Generate React component templates
    await generateReactTemplates();

    // Generate Node.js backend templates
    await generateBackendTemplates();

    // Generate Docker templates
    await generateDockerTemplates();

    // Generate testing templates
    await generateTestingTemplates();

    console.log('✅ Templates built successfully!');

  } catch (error) {
    console.error('❌ Failed to build templates:', error);
    process.exit(1);
  }
}

async function generateReactTemplates() {
  const reactDir = path.join(TEMPLATES_DIR, 'react');
  await fs.ensureDir(reactDir);

  // Component template
  const componentTemplate = `import React from 'react';
import { clsx } from 'clsx';

interface {{COMPONENT_NAME}}Props {
  className?: string;
  children?: React.ReactNode;
}

export function {{COMPONENT_NAME}}({ className, children }: {{COMPONENT_NAME}}Props) {
  return (
    <div className={clsx('{{COMPONENT_CLASS}}', className)}>
      {children}
    </div>
  );
}
`;

  await fs.writeFile(
    path.join(reactDir, 'component.template.tsx'),
    componentTemplate
  );

  // Page template
  const pageTemplate = `import React from 'react';
import { useEffect, useState } from 'react';
import { Card, Button } from '@/components/ui';

export function {{PAGE_NAME}}Page() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize page data
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="page {{PAGE_CLASS}}">
      <div className="page-header">
        <h1>{{PAGE_TITLE}}</h1>
      </div>
      
      <div className="page-content">
        <Card>
          <p>{{PAGE_DESCRIPTION}}</p>
        </Card>
      </div>
    </div>
  );
}
`;

  await fs.writeFile(
    path.join(reactDir, 'page.template.tsx'),
    pageTemplate
  );

  // Hook template
  const hookTemplate = `import { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';

interface {{HOOK_NAME}}Result {
  data: {{DATA_TYPE}}[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function {{HOOK_NAME}}(): {{HOOK_NAME}}Result {
  const [data, setData] = useState<{{DATA_TYPE}}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('{{API_ENDPOINT}}');
      setData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
}
`;

  await fs.writeFile(
    path.join(reactDir, 'hook.template.tsx'),
    hookTemplate
  );

  console.log('✅ React templates generated');
}

async function generateBackendTemplates() {
  const backendDir = path.join(TEMPLATES_DIR, 'backend');
  await fs.ensureDir(backendDir);

  // Controller template
  const controllerTemplate = `import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { {{SERVICE_NAME}} } from '../services/{{SERVICE_NAME}}';
import { createError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

export class {{CONTROLLER_NAME}} {
  private {{SERVICE_INSTANCE}}: {{SERVICE_NAME}};

  constructor() {
    this.{{SERVICE_INSTANCE}} = new {{SERVICE_NAME}}();
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 10 } = req.query;
      
      const result = await this.{{SERVICE_INSTANCE}}.findAll({
        page: Number(page),
        limit: Number(limit)
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      const item = await this.{{SERVICE_INSTANCE}}.findById(id);
      
      if (!item) {
        return next(createError('{{RESOURCE_NAME}} not found', 404));
      }

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(createError('Validation failed', 400));
      }

      const item = await this.{{SERVICE_INSTANCE}}.create({
        ...req.body,
        userId: req.user!.id
      });

      res.status(201).json({
        success: true,
        data: item,
        message: '{{RESOURCE_NAME}} created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(createError('Validation failed', 400));
      }

      const { id } = req.params;
      
      const item = await this.{{SERVICE_INSTANCE}}.update(id, req.body, req.user!.id);
      
      if (!item) {
        return next(createError('{{RESOURCE_NAME}} not found', 404));
      }

      res.json({
        success: true,
        data: item,
        message: '{{RESOURCE_NAME}} updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      const deleted = await this.{{SERVICE_INSTANCE}}.delete(id, req.user!.id);
      
      if (!deleted) {
        return next(createError('{{RESOURCE_NAME}} not found', 404));
      }

      res.json({
        success: true,
        message: '{{RESOURCE_NAME}} deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
`;

  await fs.writeFile(
    path.join(backendDir, 'controller.template.ts'),
    controllerTemplate
  );

  // Service template
  const serviceTemplate = `import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../utils/database';
import { {{MODEL_TYPE}}, Create{{MODEL_TYPE}}Data, Update{{MODEL_TYPE}}Data } from '../models/{{MODEL_TYPE}}';

interface FindAllOptions {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface FindAllResult {
  data: {{MODEL_TYPE}}[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class {{SERVICE_NAME}} {
  private db: Pool;

  constructor() {
    this.db = database;
  }

  async findAll(options: FindAllOptions): Promise<FindAllResult> {
    const { page, limit, search, sortBy = 'created_at', sortOrder = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query = \`
      SELECT * FROM {{TABLE_NAME}}
      WHERE 1=1
    \`;
    const params: any[] = [];

    if (search) {
      query += \` AND (name ILIKE $\${params.length + 1} OR description ILIKE $\${params.length + 1})\`;
      params.push(\`%\${search}%\`);
    }

    // Count total records
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    query += \` ORDER BY \${sortBy} \${sortOrder} LIMIT $\${params.length + 1} OFFSET $\${params.length + 2}\`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return {
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findById(id: string): Promise<{{MODEL_TYPE}} | null> {
    const query = 'SELECT * FROM {{TABLE_NAME}} WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    return result.rows[0] || null;
  }

  async create(data: Create{{MODEL_TYPE}}Data): Promise<{{MODEL_TYPE}}> {
    const id = uuidv4();
    const query = \`
      INSERT INTO {{TABLE_NAME}} ({{INSERT_FIELDS}})
      VALUES ({{INSERT_PLACEHOLDERS}})
      RETURNING *
    \`;
    
    const values = [id, ...Object.values(data), new Date(), new Date()];
    const result = await this.db.query(query, values);
    
    return result.rows[0];
  }

  async update(id: string, data: Update{{MODEL_TYPE}}Data, userId?: string): Promise<{{MODEL_TYPE}} | null> {
    // Check if item exists and user has permission
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    if (userId && existing.user_id !== userId) {
      throw new Error('Permission denied');
    }

    const setClause = [];
    const values = [];
    let paramCount = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        setClause.push(\`\${key} = $\${paramCount}\`);
        values.push(value);
        paramCount++;
      }
    });

    if (setClause.length === 0) {
      return existing;
    }

    setClause.push(\`updated_at = $\${paramCount}\`);
    values.push(new Date());
    values.push(id);

    const query = \`
      UPDATE {{TABLE_NAME}} 
      SET \${setClause.join(', ')} 
      WHERE id = $\${paramCount + 1}
      RETURNING *
    \`;
    
    const result = await this.db.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id: string, userId?: string): Promise<boolean> {
    // Check if item exists and user has permission
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }

    if (userId && existing.user_id !== userId) {
      throw new Error('Permission denied');
    }

    const query = 'DELETE FROM {{TABLE_NAME}} WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    return result.rowCount > 0;
  }
}
`;

  await fs.writeFile(
    path.join(backendDir, 'service.template.ts'),
    serviceTemplate
  );

  console.log('✅ Backend templates generated');
}

async function generateDockerTemplates() {
  const dockerDir = path.join(TEMPLATES_DIR, 'docker');
  await fs.ensureDir(dockerDir);

  // Frontend Dockerfile template
  const frontendDockerfile = `# Frontend Dockerfile for {{APP_NAME}}
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

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
`;

  await fs.writeFile(
    path.join(dockerDir, 'frontend.dockerfile'),
    frontendDockerfile
  );

  // Backend Dockerfile template
  const backendDockerfile = `# Backend Dockerfile for {{APP_NAME}}
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
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

# Copy built application
COPY --from=builder --chown=backend:nodejs /app/dist ./dist

# Create uploads directory (if needed)
RUN mkdir -p uploads && chown backend:nodejs uploads

# Switch to non-root user
USER backend

# Expose port
EXPOSE {{BACKEND_PORT}}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:{{BACKEND_PORT}}/health', (res) => { \\
    process.exit(res.statusCode === 200 ? 0 : 1) \\
  }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/server.js"]
`;

  await fs.writeFile(
    path.join(dockerDir, 'backend.dockerfile'),
    backendDockerfile
  );

  console.log('✅ Docker templates generated');
}

async function generateTestingTemplates() {
  const testingDir = path.join(TEMPLATES_DIR, 'testing');
  await fs.ensureDir(testingDir);

  // Component test template
  const componentTestTemplate = `import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { {{COMPONENT_NAME}} } from '../{{COMPONENT_PATH}}';

describe('{{COMPONENT_NAME}}', () => {
  test('renders without crashing', () => {
    render(<{{COMPONENT_NAME}} />);
    expect(screen.getByRole('{{MAIN_ROLE}}')).toBeInTheDocument();
  });

  test('displays correct content', () => {
    const props = {
      {{TEST_PROPS}}
    };
    
    render(<{{COMPONENT_NAME}} {...props} />);
    
    {{CONTENT_ASSERTIONS}}
  });

  test('handles user interactions', async () => {
    const mockHandler = jest.fn();
    const props = {
      {{INTERACTION_PROPS}},
      onAction: mockHandler
    };
    
    render(<{{COMPONENT_NAME}} {...props} />);
    
    const actionButton = screen.getByRole('button', { name: /{{ACTION_NAME}}/i });
    fireEvent.click(actionButton);
    
    await waitFor(() => {
      expect(mockHandler).toHaveBeenCalledWith({{EXPECTED_ARGS}});
    });
  });

  test('handles error states', () => {
    const props = {
      error: 'Test error message'
    };
    
    render(<{{COMPONENT_NAME}} {...props} />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  test('has proper accessibility attributes', () => {
    render(<{{COMPONENT_NAME}} />);
    
    const element = screen.getByRole('{{MAIN_ROLE}}');
    expect(element).toHaveAttribute('aria-label');
  });
});
`;

  await fs.writeFile(
    path.join(testingDir, 'component.test.template.tsx'),
    componentTestTemplate
  );

  // API test template
  const apiTestTemplate = `import request from 'supertest';
import app from '../server';
import { {{MODEL_TYPE}} } from '../models/{{MODEL_TYPE}}';

describe('{{ENDPOINT_PATH}}', () => {
  beforeEach(async () => {
    // Setup test data
    {{SETUP_CODE}}
  });

  afterEach(async () => {
    // Cleanup test data
    {{CLEANUP_CODE}}
  });

  describe('GET {{ENDPOINT_PATH}}', () => {
    test('should return all items', async () => {
      const response = await request(app.app)
        .get('{{ENDPOINT_PATH}}')
        {{AUTH_HEADER}};

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should handle pagination', async () => {
      const response = await request(app.app)
        .get('{{ENDPOINT_PATH}}?page=1&limit=5')
        {{AUTH_HEADER}};

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(5);
      expect(response.body).toHaveProperty('pagination');
    });

    test('should handle search', async () => {
      const response = await request(app.app)
        .get('{{ENDPOINT_PATH}}?search=test')
        {{AUTH_HEADER}};

      expect(response.status).toBe(200);
      // Verify search results
    });
  });

  describe('POST {{ENDPOINT_PATH}}', () => {
    test('should create new item', async () => {
      const newItem = {
        {{VALID_PAYLOAD}}
      };

      const response = await request(app.app)
        .post('{{ENDPOINT_PATH}}')
        .send(newItem)
        {{AUTH_HEADER}};

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toMatchObject(newItem);
    });

    test('should validate required fields', async () => {
      const invalidItem = {
        {{INVALID_PAYLOAD}}
      };

      const response = await request(app.app)
        .post('{{ENDPOINT_PATH}}')
        .send(invalidItem)
        {{AUTH_HEADER}};

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });

    {{AUTH_REQUIRED_TEST}}
  });

  describe('PUT {{ENDPOINT_PATH}}/:id', () => {
    test('should update existing item', async () => {
      const updates = {
        {{UPDATE_PAYLOAD}}
      };

      const response = await request(app.app)
        .put(\`{{ENDPOINT_PATH}}/\${testItemId}\`)
        .send(updates)
        {{AUTH_HEADER}};

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject(updates);
    });

    test('should return 404 for non-existent item', async () => {
      const response = await request(app.app)
        .put(\`{{ENDPOINT_PATH}}/non-existent-id\`)
        .send({ {{UPDATE_PAYLOAD}} })
        {{AUTH_HEADER}};

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE {{ENDPOINT_PATH}}/:id', () => {
    test('should delete existing item', async () => {
      const response = await request(app.app)
        .delete(\`{{ENDPOINT_PATH}}/\${testItemId}\`)
        {{AUTH_HEADER}};

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });
});
`;

  await fs.writeFile(
    path.join(testingDir, 'api.test.template.ts'),
    apiTestTemplate
  );

  console.log('✅ Testing templates generated');
}

// Run the build script
if (require.main === module) {
  buildTemplates().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}

module.exports = buildTemplates;
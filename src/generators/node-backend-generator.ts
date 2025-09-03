import path from 'path';
import fs from 'fs-extra';
import { RequirementSpec, GeneratedFile, FrameworkConfig } from '../types';
import { Logger } from '../utils/logger';

export class NodeBackendGenerator {
  private logger: Logger;
  private config: FrameworkConfig;

  constructor(config: FrameworkConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async generate(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    this.logger.info('Generating Node.js backend...');
    
    await fs.ensureDir(outputDir);
    const files: GeneratedFile[] = [];

    files.push(...await this.generateProjectSetup(spec, outputDir));
    files.push(...await this.generateServerSetup(spec, outputDir));
    files.push(...await this.generateMiddleware(spec, outputDir));
    files.push(...await this.generateRoutes(spec, outputDir));
    files.push(...await this.generateModels(spec, outputDir));
    files.push(...await this.generateControllers(spec, outputDir));
    files.push(...await this.generateServices(spec, outputDir));
    files.push(...await this.generateUtils(spec, outputDir));

    return files;
  }

  private async generateProjectSetup(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const packageJson = {
      name: `${spec.title.toLowerCase().replace(/\s+/g, '-')}-backend`,
      version: '1.0.0',
      description: `Backend API for ${spec.title}`,
      main: 'dist/server.js',
      scripts: {
        dev: 'nodemon src/server.ts',
        build: 'tsc',
        start: 'node dist/server.js',
        test: 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage',
        lint: 'eslint src/**/*.ts',
        'lint:fix': 'eslint src/**/*.ts --fix'
      },
      dependencies: {
        express: '^4.18.2',
        '@types/express': '^4.17.21',
        cors: '^2.8.5',
        '@types/cors': '^2.8.17',
        helmet: '^7.1.0',
        compression: '^1.7.4',
        '@types/compression': '^1.7.5',
        'express-rate-limit': '^6.10.0',
        'express-validator': '^7.0.1',
        dotenv: '^16.3.1',
        winston: '^3.11.0',
        ...(spec.authentication && {
          jsonwebtoken: '^9.0.2',
          '@types/jsonwebtoken': '^9.0.5',
          bcryptjs: '^2.4.3',
          '@types/bcryptjs': '^2.4.6'
        }),
        ...(spec.database && spec.techStack.database.type === 'postgresql' && {
          pg: '^8.11.3',
          '@types/pg': '^8.10.7'
        }),
        ...(spec.database && spec.techStack.database.type === 'mongodb' && {
          mongoose: '^7.6.3',
          '@types/mongoose': '^5.11.97'
        }),
        ...(spec.fileUploads && {
          multer: '^1.4.5-lts.1',
          '@types/multer': '^1.4.10'
        }),
        ...(spec.notifications && {
          nodemailer: '^6.9.7',
          '@types/nodemailer': '^6.4.14'
        }),
        ...(spec.realtime && {
          'socket.io': '^4.7.4'
        })
      },
      devDependencies: {
        typescript: '^5.2.2',
        '@types/node': '^20.8.7',
        nodemon: '^3.0.1',
        'ts-node': '^10.9.1',
        jest: '^29.7.0',
        '@types/jest': '^29.5.7',
        'ts-jest': '^29.1.1',
        eslint: '^8.52.0',
        '@typescript-eslint/eslint-plugin': '^6.9.1',
        '@typescript-eslint/parser': '^6.9.1',
        supertest: '^6.3.3',
        '@types/supertest': '^2.0.16'
      }
    };

    const packageJsonPath = path.join(outputDir, 'package.json');
    await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
    files.push({
      path: 'backend/package.json',
      content: JSON.stringify(packageJson, null, 2),
      type: 'json',
      lastModified: new Date(),
      size: JSON.stringify(packageJson).length
    });

    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        lib: ['ES2020'],
        module: 'commonjs',
        declaration: true,
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        sourceMap: true,
        baseUrl: '.',
        paths: {
          '@/*': ['src/*'],
          '@/controllers/*': ['src/controllers/*'],
          '@/middleware/*': ['src/middleware/*'],
          '@/models/*': ['src/models/*'],
          '@/routes/*': ['src/routes/*'],
          '@/services/*': ['src/services/*'],
          '@/utils/*': ['src/utils/*'],
          '@/types/*': ['src/types/*']
        }
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    };

    const tsConfigPath = path.join(outputDir, 'tsconfig.json');
    await fs.writeJSON(tsConfigPath, tsConfig, { spaces: 2 });
    files.push({
      path: 'backend/tsconfig.json',
      content: JSON.stringify(tsConfig, null, 2),
      type: 'json',
      lastModified: new Date(),
      size: JSON.stringify(tsConfig).length
    });

    return files;
  }

  private async generateServerSetup(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const srcDir = path.join(outputDir, 'src');
    await fs.ensureDir(srcDir);

    const serverFile = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
${spec.authentication ? "import { authRoutes } from './routes/auth';" : ''}
${spec.database ? "import { connectDatabase } from './utils/database';" : ''}
${spec.realtime ? "import { createServer } from 'http';" : ''}
${spec.realtime ? "import { Server } from 'socket.io';" : ''}

class App {
  public app: express.Application;
  ${spec.realtime ? 'public server: any;' : ''}
  ${spec.realtime ? 'public io: Server;' : ''}

  constructor() {
    this.app = express();
    ${spec.realtime ? 'this.server = createServer(this.app);' : ''}
    ${spec.realtime ? 'this.io = new Server(this.server, { cors: { origin: "*" } });' : ''}
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    ${spec.realtime ? 'this.initializeSocketIO();' : ''}
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use(limiter);

    // General middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(requestLogger);
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // API routes
    ${spec.authentication ? "this.app.use('/api/auth', authRoutes);" : ''}
    
    // Add other routes here
    ${spec.features.map(feature => {
      const routeName = feature.name.toLowerCase().replace(/\s+/g, '-');
      return `// this.app.use('/api/${routeName}', ${routeName}Routes);`;
    }).join('\n    ')}
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    });

    // Global error handler
    this.app.use(errorHandler);
  }

  ${spec.realtime ? `private initializeSocketIO(): void {
    this.io.on('connection', (socket) => {
      logger.info('Client connected:', socket.id);
      
      socket.on('disconnect', () => {
        logger.info('Client disconnected:', socket.id);
      });
      
      // Add socket event handlers here
    });
  }` : ''}

  public async start(): Promise<void> {
    try {
      ${spec.database ? 'await connectDatabase();' : ''}
      
      const port = config.port;
      ${spec.realtime ? 'this.server' : 'this.app'}.listen(port, () => {
        logger.info(\`Server running on port \${port}\`);
        logger.info(\`Environment: \${config.nodeEnv}\`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server
const app = new App();
app.start().catch((error) => {
  logger.error('Application startup failed:', error);
  process.exit(1);
});

export default app;
`;

    const serverPath = path.join(srcDir, 'server.ts');
    await fs.writeFile(serverPath, serverFile);
    files.push({
      path: 'backend/src/server.ts',
      content: serverFile,
      type: 'typescript',
      lastModified: new Date(),
      size: serverFile.length
    });

    const configFile = `import dotenv from 'dotenv';
dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  ${spec.authentication ? `jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },` : ''}
  
  ${spec.database ? `database: {
    ${spec.techStack.database.type === 'postgresql' ? `
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || '${spec.techStack.database.database}',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',` : ''}
    ${spec.techStack.database.type === 'mongodb' ? `
    url: process.env.DATABASE_URL || 'mongodb://localhost:27017/${spec.techStack.database.database}',` : ''}
  },` : ''}
  
  ${spec.notifications ? `email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
  },` : ''}
  
  ${spec.fileUploads ? `upload: {
    maxSize: process.env.UPLOAD_MAX_SIZE || '10MB',
    allowedTypes: process.env.UPLOAD_ALLOWED_TYPES?.split(',') || ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
  },` : ''}
};
`;

    const configPath = path.join(srcDir, 'config.ts');
    await fs.writeFile(configPath, configFile);
    files.push({
      path: 'backend/src/config.ts',
      content: configFile,
      type: 'typescript',
      lastModified: new Date(),
      size: configFile.length
    });

    return files;
  }

  private async generateMiddleware(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const middlewareDir = path.join(outputDir, 'src', 'middleware');
    await fs.ensureDir(middlewareDir);

    const errorHandler = `import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let { statusCode = 500, message } = err;

  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const createError = (message: string, statusCode = 500): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};
`;

    const errorHandlerPath = path.join(middlewareDir, 'errorHandler.ts');
    await fs.writeFile(errorHandlerPath, errorHandler);
    files.push({
      path: 'backend/src/middleware/errorHandler.ts',
      content: errorHandler,
      type: 'typescript',
      lastModified: new Date(),
      size: errorHandler.length
    });

    const requestLogger = `import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: \`\${duration}ms\`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};
`;

    const requestLoggerPath = path.join(middlewareDir, 'requestLogger.ts');
    await fs.writeFile(requestLoggerPath, requestLogger);
    files.push({
      path: 'backend/src/middleware/requestLogger.ts',
      content: requestLogger,
      type: 'typescript',
      lastModified: new Date(),
      size: requestLogger.length
    });

    if (spec.authentication) {
      const authMiddleware = `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { createError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw createError('Access denied. No token provided.', 401);
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any;
    req.user = decoded;
    
    next();
  } catch (error) {
    next(createError('Invalid token', 401));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('Access denied', 401));
    }

    // Add role checking logic here if needed
    next();
  };
};
`;

      const authMiddlewarePath = path.join(middlewareDir, 'auth.ts');
      await fs.writeFile(authMiddlewarePath, authMiddleware);
      files.push({
        path: 'backend/src/middleware/auth.ts',
        content: authMiddleware,
        type: 'typescript',
        lastModified: new Date(),
        size: authMiddleware.length
      });
    }

    if (spec.fileUploads) {
      const uploadMiddleware = `import multer from 'multer';
import path from 'path';
import { config } from '../config';
import { createError } from './errorHandler';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = config.upload.allowedTypes;
  const fileExtension = path.extname(file.originalname).slice(1).toLowerCase();
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(createError(\`File type .\${fileExtension} is not allowed\`, 400));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(config.upload.maxSize.replace('MB', '')) * 1024 * 1024,
  },
});
`;

      const uploadMiddlewarePath = path.join(middlewareDir, 'upload.ts');
      await fs.writeFile(uploadMiddlewarePath, uploadMiddleware);
      files.push({
        path: 'backend/src/middleware/upload.ts',
        content: uploadMiddleware,
        type: 'typescript',
        lastModified: new Date(),
        size: uploadMiddleware.length
      });
    }

    return files;
  }

  private async generateRoutes(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const routesDir = path.join(outputDir, 'src', 'routes');
    await fs.ensureDir(routesDir);

    if (spec.authentication) {
      const authRoutes = `import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middleware/auth';

export const authRoutes = Router();
const authController = new AuthController();

// Register
authRoutes.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  authController.register.bind(authController)
);

// Login
authRoutes.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  authController.login.bind(authController)
);

// Get current user
authRoutes.get('/me', authenticate, authController.getCurrentUser.bind(authController));

// Logout
authRoutes.post('/logout', authenticate, authController.logout.bind(authController));

// Refresh token
authRoutes.post('/refresh', authController.refreshToken.bind(authController));
`;

      const authRoutesPath = path.join(routesDir, 'auth.ts');
      await fs.writeFile(authRoutesPath, authRoutes);
      files.push({
        path: 'backend/src/routes/auth.ts',
        content: authRoutes,
        type: 'typescript',
        lastModified: new Date(),
        size: authRoutes.length
      });
    }

    return files;
  }

  private async generateControllers(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const controllersDir = path.join(outputDir, 'src', 'controllers');
    await fs.ensureDir(controllersDir);

    if (spec.authentication) {
      const authController = `import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { createError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
${spec.database && spec.techStack.database.type === 'postgresql' ? "import { UserService } from '../services/UserService';" : ''}

export class AuthController {
  ${spec.database ? 'private userService: UserService;' : ''}

  constructor() {
    ${spec.database ? 'this.userService = new UserService();' : ''}
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(createError('Validation failed', 400));
      }

      const { name, email, password } = req.body;

      ${spec.database ? `
      // Check if user already exists
      const existingUser = await this.userService.findByEmail(email);
      if (existingUser) {
        return next(createError('User already exists', 409));
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await this.userService.create({
        name,
        email,
        password: hashedPassword,
      });

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
          token,
        },
        message: 'User registered successfully',
      });` : `
      // Mock implementation without database
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const user = {
        id: Date.now().toString(),
        name,
        email,
        password: hashedPassword,
      };

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
          token,
        },
        message: 'User registered successfully',
      });`}
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(createError('Validation failed', 400));
      }

      const { email, password } = req.body;

      ${spec.database ? `
      // Find user
      const user = await this.userService.findByEmail(email);
      if (!user) {
        return next(createError('Invalid credentials', 401));
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return next(createError('Invalid credentials', 401));
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
          token,
        },
        message: 'Login successful',
      });` : `
      // Mock implementation without database
      if (email === 'demo@example.com' && password === 'password123') {
        const user = {
          id: '1',
          name: 'Demo User',
          email: 'demo@example.com',
        };

        const token = jwt.sign(user, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

        res.json({
          success: true,
          data: { user, token },
          message: 'Login successful',
        });
      } else {
        return next(createError('Invalid credentials', 401));
      }`}
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      ${spec.database ? `
      const user = await this.userService.findById(req.user!.id);
      if (!user) {
        return next(createError('User not found', 404));
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        },
      });` : `
      res.json({
        success: true,
        data: {
          user: req.user,
        },
      });`}
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    // In a real implementation, you might invalidate the token in a blacklist
    res.json({
      success: true,
      message: 'Logout successful',
    });
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return next(createError('Refresh token is required', 401));
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as any;
      
      // Generate new access token
      const newToken = jwt.sign(
        { id: decoded.id, email: decoded.email, name: decoded.name },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({
        success: true,
        data: {
          token: newToken,
        },
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      next(createError('Invalid refresh token', 401));
    }
  }
}
`;

      const authControllerPath = path.join(controllersDir, 'AuthController.ts');
      await fs.writeFile(authControllerPath, authController);
      files.push({
        path: 'backend/src/controllers/AuthController.ts',
        content: authController,
        type: 'typescript',
        lastModified: new Date(),
        size: authController.length
      });
    }

    return files;
  }

  private async generateModels(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    
    if (!spec.database) return files;
    
    const modelsDir = path.join(outputDir, 'src', 'models');
    await fs.ensureDir(modelsDir);

    if (spec.techStack.database.type === 'postgresql') {
      const userModel = `export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
}
`;

      const userModelPath = path.join(modelsDir, 'User.ts');
      await fs.writeFile(userModelPath, userModel);
      files.push({
        path: 'backend/src/models/User.ts',
        content: userModel,
        type: 'typescript',
        lastModified: new Date(),
        size: userModel.length
      });
    }

    return files;
  }

  private async generateServices(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    
    if (!spec.database) return files;
    
    const servicesDir = path.join(outputDir, 'src', 'services');
    await fs.ensureDir(servicesDir);

    if (spec.authentication && spec.techStack.database.type === 'postgresql') {
      const userService = `import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../utils/database';
import { User, CreateUserData, UpdateUserData } from '../models/User';

export class UserService {
  private db: Pool;

  constructor() {
    this.db = database;
  }

  async create(userData: CreateUserData): Promise<User> {
    const id = uuidv4();
    const query = \`
      INSERT INTO users (id, name, email, password, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    \`;
    
    const result = await this.db.query(query, [
      id,
      userData.name,
      userData.email,
      userData.password,
    ]);
    
    return result.rows[0];
  }

  async findById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.db.query(query, [email]);
    
    return result.rows[0] || null;
  }

  async update(id: string, userData: UpdateUserData): Promise<User | null> {
    const setClause = [];
    const values = [];
    let paramCount = 1;

    if (userData.name) {
      setClause.push(\`name = $\${paramCount}\`);
      values.push(userData.name);
      paramCount++;
    }

    if (userData.email) {
      setClause.push(\`email = $\${paramCount}\`);
      values.push(userData.email);
      paramCount++;
    }

    if (userData.password) {
      setClause.push(\`password = $\${paramCount}\`);
      values.push(userData.password);
      paramCount++;
    }

    if (setClause.length === 0) {
      return this.findById(id);
    }

    setClause.push(\`updated_at = NOW()\`);
    values.push(id);

    const query = \`
      UPDATE users 
      SET \${setClause.join(', ')} 
      WHERE id = $\${paramCount}
      RETURNING *
    \`;
    
    const result = await this.db.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    return result.rowCount > 0;
  }

  async findAll(limit = 10, offset = 0): Promise<User[]> {
    const query = \`
      SELECT id, name, email, created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    \`;
    
    const result = await this.db.query(query, [limit, offset]);
    return result.rows;
  }
}
`;

      const userServicePath = path.join(servicesDir, 'UserService.ts');
      await fs.writeFile(userServicePath, userService);
      files.push({
        path: 'backend/src/services/UserService.ts',
        content: userService,
        type: 'typescript',
        lastModified: new Date(),
        size: userService.length
      });
    }

    return files;
  }

  private async generateUtils(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const utilsDir = path.join(outputDir, 'src', 'utils');
    await fs.ensureDir(utilsDir);

    const logger = `import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = \`\${timestamp} [\${level.toUpperCase()}]: \${message}\`;
    
    if (Object.keys(meta).length > 0) {
      log += \` \${JSON.stringify(meta)}\`;
    }
    
    if (stack) {
      log += \`\\n\${stack}\`;
    }
    
    return log;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});
`;

    const loggerPath = path.join(utilsDir, 'logger.ts');
    await fs.writeFile(loggerPath, logger);
    files.push({
      path: 'backend/src/utils/logger.ts',
      content: logger,
      type: 'typescript',
      lastModified: new Date(),
      size: logger.length
    });

    if (spec.database) {
      let databaseUtil = '';
      
      if (spec.techStack.database.type === 'postgresql') {
        databaseUtil = `import { Pool } from 'pg';
import { config } from '../config';
import { logger } from './logger';

export let database: Pool;

export const connectDatabase = async (): Promise<void> => {
  try {
    database = new Pool({
      connectionString: config.database.url,
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.username,
      password: config.database.password,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    // Test the connection
    await database.query('SELECT NOW()');
    logger.info('PostgreSQL database connected successfully');

    // Create tables if they don't exist
    await createTables();
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL database:', error);
    throw error;
  }
};

const createTables = async (): Promise<void> => {
  try {
    ${spec.authentication ? `
    // Create users table
    await database.query(\`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    \`);
    
    // Create index on email
    await database.query(\`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    \`);` : ''}

    logger.info('Database tables created/verified successfully');
  } catch (error) {
    logger.error('Failed to create database tables:', error);
    throw error;
  }
};

export const closeDatabaseConnection = async (): Promise<void> => {
  if (database) {
    await database.end();
    logger.info('Database connection closed');
  }
};
`;
      }

      if (spec.techStack.database.type === 'mongodb') {
        databaseUtil = `import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from './logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(config.database.url);
    logger.info('MongoDB database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to MongoDB database:', error);
    throw error;
  }
};

export const closeDatabaseConnection = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }
};

// Mongoose connection event handlers
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  logger.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from MongoDB');
});
`;
      }

      const databasePath = path.join(utilsDir, 'database.ts');
      await fs.writeFile(databasePath, databaseUtil);
      files.push({
        path: 'backend/src/utils/database.ts',
        content: databaseUtil,
        type: 'typescript',
        lastModified: new Date(),
        size: databaseUtil.length
      });
    }

    return files;
  }
}
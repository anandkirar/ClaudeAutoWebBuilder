import path from 'path';
import fs from 'fs-extra';
import { RequirementSpec, GeneratedFile, FrameworkConfig } from '../types';
import { Logger } from '../utils/logger';

export class ReactGenerator {
  private logger: Logger;
  private config: FrameworkConfig;

  constructor(config: FrameworkConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async generate(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    this.logger.info('Generating React frontend...');
    
    await fs.ensureDir(outputDir);
    const files: GeneratedFile[] = [];

    files.push(...await this.generateProjectSetup(spec, outputDir));
    files.push(...await this.generateComponents(spec, outputDir));
    files.push(...await this.generatePages(spec, outputDir));
    files.push(...await this.generateHooks(spec, outputDir));
    files.push(...await this.generateUtils(spec, outputDir));
    files.push(...await this.generateStyles(spec, outputDir));
    files.push(...await this.generateTypes(spec, outputDir));

    return files;
  }

  private async generateProjectSetup(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const packageJson = {
      name: `${spec.title.toLowerCase().replace(/\s+/g, '-')}-frontend`,
      version: '0.1.0',
      private: true,
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        'react-router-dom': '^6.8.0',
        '@types/node': '^18.14.2',
        '@types/react': '^18.0.28',
        '@types/react-dom': '^18.0.11',
        typescript: '^4.9.5',
        ...(spec.techStack.frontend.styling === 'tailwind' && {
          tailwindcss: '^3.2.7',
          '@tailwindcss/forms': '^0.5.3',
          '@tailwindcss/typography': '^0.5.9',
          autoprefixer: '^10.4.14',
          postcss: '^8.4.21'
        }),
        ...(spec.techStack.frontend.stateManagement === 'redux' && {
          '@reduxjs/toolkit': '^1.9.3',
          'react-redux': '^8.0.5'
        }),
        ...(spec.techStack.frontend.stateManagement === 'zustand' && {
          zustand: '^4.3.6'
        }),
        ...(spec.authentication && {
          '@auth0/auth0-react': '^2.0.1'
        }),
        ...(spec.realtime && {
          'socket.io-client': '^4.6.1'
        }),
        axios: '^1.3.4',
        'react-hook-form': '^7.43.5',
        'react-hot-toast': '^2.4.0',
        'react-query': '^3.39.3',
        'date-fns': '^2.29.3',
        clsx: '^1.2.1'
      },
      devDependencies: {
        '@vitejs/plugin-react': '^3.1.0',
        vite: '^4.1.4',
        '@testing-library/jest-dom': '^5.16.5',
        '@testing-library/react': '^14.0.0',
        '@testing-library/user-event': '^14.4.3',
        '@types/jest': '^29.4.0',
        eslint: '^8.36.0',
        'eslint-plugin-react-hooks': '^4.6.0',
        'eslint-plugin-react-refresh': '^0.3.4',
        prettier: '^2.8.4'
      },
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        lint: 'eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
        preview: 'vite preview',
        test: 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage'
      }
    };

    const packageJsonPath = path.join(outputDir, 'package.json');
    await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
    files.push({
      path: 'frontend/package.json',
      content: JSON.stringify(packageJson, null, 2),
      type: 'json',
      lastModified: new Date(),
      size: JSON.stringify(packageJson).length
    });

    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
`;

    const viteConfigPath = path.join(outputDir, 'vite.config.ts');
    await fs.writeFile(viteConfigPath, viteConfig);
    files.push({
      path: 'frontend/vite.config.ts',
      content: viteConfig,
      type: 'typescript',
      lastModified: new Date(),
      size: viteConfig.length
    });

    if (spec.techStack.frontend.styling === 'tailwind') {
      const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
`;

      const tailwindPath = path.join(outputDir, 'tailwind.config.js');
      await fs.writeFile(tailwindPath, tailwindConfig);
      files.push({
        path: 'frontend/tailwind.config.js',
        content: tailwindConfig,
        type: 'javascript',
        lastModified: new Date(),
        size: tailwindConfig.length
      });

      const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

      const postcssPath = path.join(outputDir, 'postcss.config.js');
      await fs.writeFile(postcssPath, postcssConfig);
      files.push({
        path: 'frontend/postcss.config.js',
        content: postcssConfig,
        type: 'javascript',
        lastModified: new Date(),
        size: postcssConfig.length
      });
    }

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${spec.title}</title>
    <meta name="description" content="${spec.description}" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

    const indexHtmlPath = path.join(outputDir, 'index.html');
    await fs.writeFile(indexHtmlPath, indexHtml);
    files.push({
      path: 'frontend/index.html',
      content: indexHtml,
      type: 'html',
      lastModified: new Date(),
      size: indexHtml.length
    });

    return files;
  }

  private async generateComponents(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const componentsDir = path.join(outputDir, 'src', 'components');
    await fs.ensureDir(componentsDir);

    files.push(...await this.generateUIComponents(spec, componentsDir));
    files.push(...await this.generateLayoutComponents(spec, componentsDir));
    files.push(...await this.generateFormComponents(spec, componentsDir));

    return files;
  }

  private async generateUIComponents(spec: RequirementSpec, componentsDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const buttonComponent = `import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        {
          'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500':
            variant === 'primary',
          'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500':
            variant === 'secondary',
          'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500':
            variant === 'danger',
          'h-8 px-3 text-sm': size === 'sm',
          'h-10 px-4 py-2': size === 'md',
          'h-12 px-6 text-lg': size === 'lg',
        },
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {children}
    </button>
  );
}
`;

    const buttonPath = path.join(componentsDir, 'ui', 'Button.tsx');
    await fs.ensureDir(path.dirname(buttonPath));
    await fs.writeFile(buttonPath, buttonComponent);
    files.push({
      path: 'frontend/src/components/ui/Button.tsx',
      content: buttonComponent,
      type: 'typescript',
      lastModified: new Date(),
      size: buttonComponent.length
    });

    const inputComponent = `import React from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export function Input({
  label,
  error,
  helpText,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id || \`input-\${Math.random().toString(36).substr(2, 9)}\`;

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          'block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm',
          error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {helpText && !error && <p className="text-sm text-gray-500">{helpText}</p>}
    </div>
  );
}
`;

    const inputPath = path.join(componentsDir, 'ui', 'Input.tsx');
    await fs.writeFile(inputPath, inputComponent);
    files.push({
      path: 'frontend/src/components/ui/Input.tsx',
      content: inputComponent,
      type: 'typescript',
      lastModified: new Date(),
      size: inputComponent.length
    });

    const cardComponent = `import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-gray-200 bg-white shadow-sm',
        {
          'p-0': padding === 'none',
          'p-4': padding === 'sm',
          'p-6': padding === 'md',
          'p-8': padding === 'lg',
        },
        className
      )}
    >
      {children}
    </div>
  );
}
`;

    const cardPath = path.join(componentsDir, 'ui', 'Card.tsx');
    await fs.writeFile(cardPath, cardComponent);
    files.push({
      path: 'frontend/src/components/ui/Card.tsx',
      content: cardComponent,
      type: 'typescript',
      lastModified: new Date(),
      size: cardComponent.length
    });

    const uiIndexFile = `export { Button } from './Button';
export { Input } from './Input';
export { Card } from './Card';
`;

    const uiIndexPath = path.join(componentsDir, 'ui', 'index.ts');
    await fs.writeFile(uiIndexPath, uiIndexFile);
    files.push({
      path: 'frontend/src/components/ui/index.ts',
      content: uiIndexFile,
      type: 'typescript',
      lastModified: new Date(),
      size: uiIndexFile.length
    });

    return files;
  }

  private async generateLayoutComponents(spec: RequirementSpec, componentsDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const layoutComponent = `import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}
`;

    const layoutPath = path.join(componentsDir, 'layout', 'Layout.tsx');
    await fs.ensureDir(path.dirname(layoutPath));
    await fs.writeFile(layoutPath, layoutComponent);
    files.push({
      path: 'frontend/src/components/layout/Layout.tsx',
      content: layoutComponent,
      type: 'typescript',
      lastModified: new Date(),
      size: layoutComponent.length
    });

    const headerComponent = `import React from 'react';
import { Link } from 'react-router-dom';
${spec.authentication ? "import { useAuth } from '../hooks/useAuth';" : ''}

export function Header() {
  ${spec.authentication ? 'const { user, logout } = useAuth();' : ''}

  return (
    <header className="bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link
              to="/"
              className="text-xl font-bold text-primary-600"
            >
              ${spec.title}
            </Link>
          </div>
          
          <nav className="hidden md:flex space-x-8">
            <Link
              to="/"
              className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
            >
              Home
            </Link>
            ${spec.features.map(feature => `
            <Link
              to="/${feature.name.toLowerCase().replace(/\s+/g, '-')}"
              className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
            >
              ${feature.name}
            </Link>`).join('')}
          </nav>

          <div className="flex items-center space-x-4">
            ${spec.authentication ? `
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  Welcome, {user.name}
                </span>
                <button
                  onClick={logout}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700"
                >
                  Register
                </Link>
              </div>
            )}` : ''}
          </div>
        </div>
      </div>
    </header>
  );
}
`;

    const headerPath = path.join(componentsDir, 'layout', 'Header.tsx');
    await fs.writeFile(headerPath, headerComponent);
    files.push({
      path: 'frontend/src/components/layout/Header.tsx',
      content: headerComponent,
      type: 'typescript',
      lastModified: new Date(),
      size: headerComponent.length
    });

    const footerComponent = `import React from 'react';

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="text-center text-sm text-gray-500">
          © {new Date().getFullYear()} ${spec.title}. Generated by Autonomous Web Framework.
        </div>
      </div>
    </footer>
  );
}
`;

    const footerPath = path.join(componentsDir, 'layout', 'Footer.tsx');
    await fs.writeFile(footerPath, footerComponent);
    files.push({
      path: 'frontend/src/components/layout/Footer.tsx',
      content: footerComponent,
      type: 'typescript',
      lastModified: new Date(),
      size: footerComponent.length
    });

    return files;
  }

  private async generateFormComponents(spec: RequirementSpec, componentsDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    if (spec.authentication) {
      const loginFormComponent = `import React from 'react';
import { useForm } from 'react-hook-form';
import { Button, Input, Card } from '../ui';

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
  loading?: boolean;
}

export function LoginForm({ onSubmit, loading = false }: LoginFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();

  return (
    <Card className="w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">Login</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email"
          type="email"
          {...register('email', { 
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$/i,
              message: 'Invalid email address'
            }
          })}
          error={errors.email?.message}
        />
        
        <Input
          label="Password"
          type="password"
          {...register('password', { 
            required: 'Password is required',
            minLength: {
              value: 6,
              message: 'Password must be at least 6 characters'
            }
          })}
          error={errors.password?.message}
        />
        
        <Button
          type="submit"
          className="w-full"
          loading={loading}
        >
          Login
        </Button>
      </form>
    </Card>
  );
}
`;

      const loginFormPath = path.join(componentsDir, 'forms', 'LoginForm.tsx');
      await fs.ensureDir(path.dirname(loginFormPath));
      await fs.writeFile(loginFormPath, loginFormComponent);
      files.push({
        path: 'frontend/src/components/forms/LoginForm.tsx',
        content: loginFormComponent,
        type: 'typescript',
        lastModified: new Date(),
        size: loginFormComponent.length
      });

      const registerFormComponent = `import React from 'react';
import { useForm } from 'react-hook-form';
import { Button, Input, Card } from '../ui';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface RegisterFormProps {
  onSubmit: (data: Omit<RegisterFormData, 'confirmPassword'>) => Promise<void>;
  loading?: boolean;
}

export function RegisterForm({ onSubmit, loading = false }: RegisterFormProps) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterFormData>();
  const password = watch('password');

  const handleFormSubmit = (data: RegisterFormData) => {
    const { confirmPassword, ...submitData } = data;
    return onSubmit(submitData);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">Register</h2>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <Input
          label="Name"
          {...register('name', { 
            required: 'Name is required',
            minLength: {
              value: 2,
              message: 'Name must be at least 2 characters'
            }
          })}
          error={errors.name?.message}
        />
        
        <Input
          label="Email"
          type="email"
          {...register('email', { 
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$/i,
              message: 'Invalid email address'
            }
          })}
          error={errors.email?.message}
        />
        
        <Input
          label="Password"
          type="password"
          {...register('password', { 
            required: 'Password is required',
            minLength: {
              value: 8,
              message: 'Password must be at least 8 characters'
            }
          })}
          error={errors.password?.message}
        />
        
        <Input
          label="Confirm Password"
          type="password"
          {...register('confirmPassword', { 
            required: 'Please confirm your password',
            validate: (value) => value === password || 'Passwords do not match'
          })}
          error={errors.confirmPassword?.message}
        />
        
        <Button
          type="submit"
          className="w-full"
          loading={loading}
        >
          Register
        </Button>
      </form>
    </Card>
  );
}
`;

      const registerFormPath = path.join(componentsDir, 'forms', 'RegisterForm.tsx');
      await fs.writeFile(registerFormPath, registerFormComponent);
      files.push({
        path: 'frontend/src/components/forms/RegisterForm.tsx',
        content: registerFormComponent,
        type: 'typescript',
        lastModified: new Date(),
        size: registerFormComponent.length
      });
    }

    return files;
  }

  private async generatePages(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const pagesDir = path.join(outputDir, 'src', 'pages');
    await fs.ensureDir(pagesDir);

    const homePageComponent = `import React from 'react';
import { Card } from '../components/ui';

export function HomePage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to ${spec.title}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          ${spec.description}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${spec.features.slice(0, 6).map(feature => `
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            ${feature.name}
          </h3>
          <p className="text-gray-600">
            ${feature.description}
          </p>
        </Card>`).join('')}
      </div>
    </div>
  );
}
`;

    const homePagePath = path.join(pagesDir, 'HomePage.tsx');
    await fs.writeFile(homePagePath, homePageComponent);
    files.push({
      path: 'frontend/src/pages/HomePage.tsx',
      content: homePageComponent,
      type: 'typescript',
      lastModified: new Date(),
      size: homePageComponent.length
    });

    if (spec.authentication) {
      const loginPageComponent = `import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/forms/LoginForm';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();

  const handleLogin = async (data: { email: string; password: string }) => {
    try {
      await login(data.email, data.password);
      toast.success('Login successful!');
      navigate('/');
    } catch (error) {
      toast.error(error.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoginForm onSubmit={handleLogin} loading={loading} />
    </div>
  );
}
`;

      const loginPagePath = path.join(pagesDir, 'LoginPage.tsx');
      await fs.writeFile(loginPagePath, loginPageComponent);
      files.push({
        path: 'frontend/src/pages/LoginPage.tsx',
        content: loginPageComponent,
        type: 'typescript',
        lastModified: new Date(),
        size: loginPageComponent.length
      });

      const registerPageComponent = `import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RegisterForm } from '../components/forms/RegisterForm';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, loading } = useAuth();

  const handleRegister = async (data: { name: string; email: string; password: string }) => {
    try {
      await registerUser(data.name, data.email, data.password);
      toast.success('Registration successful!');
      navigate('/');
    } catch (error) {
      toast.error(error.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <RegisterForm onSubmit={handleRegister} loading={loading} />
    </div>
  );
}
`;

      const registerPagePath = path.join(pagesDir, 'RegisterPage.tsx');
      await fs.writeFile(registerPagePath, registerPageComponent);
      files.push({
        path: 'frontend/src/pages/RegisterPage.tsx',
        content: registerPageComponent,
        type: 'typescript',
        lastModified: new Date(),
        size: registerPageComponent.length
      });
    }

    return files;
  }

  private async generateHooks(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const hooksDir = path.join(outputDir, 'src', 'hooks');
    await fs.ensureDir(hooksDir);

    if (spec.authentication) {
      const useAuthHook = `import { useState, useContext, createContext, useEffect } from 'react';
import { api } from '../utils/api';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      checkAuthStatus();
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
      localStorage.removeItem('token');
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, token } = response.data;
      
      localStorage.setItem('token', token);
      setUser(user);
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', { name, email, password });
      const { user, token } = response.data;
      
      localStorage.setItem('token', token);
      setUser(user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
`;

      const useAuthPath = path.join(hooksDir, 'useAuth.tsx');
      await fs.writeFile(useAuthPath, useAuthHook);
      files.push({
        path: 'frontend/src/hooks/useAuth.tsx',
        content: useAuthHook,
        type: 'typescript',
        lastModified: new Date(),
        size: useAuthHook.length
      });
    }

    return files;
  }

  private async generateUtils(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const utilsDir = path.join(outputDir, 'src', 'utils');
    await fs.ensureDir(utilsDir);

    const apiUtil = `import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
`;

    const apiUtilPath = path.join(utilsDir, 'api.ts');
    await fs.writeFile(apiUtilPath, apiUtil);
    files.push({
      path: 'frontend/src/utils/api.ts',
      content: apiUtil,
      type: 'typescript',
      lastModified: new Date(),
      size: apiUtil.length
    });

    return files;
  }

  private async generateStyles(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const srcDir = path.join(outputDir, 'src');

    if (spec.techStack.frontend.styling === 'tailwind') {
      const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-family: system-ui, sans-serif;
  }
}

@layer components {
  .btn {
    @apply px-4 py-2 rounded-md font-medium transition-colors;
  }
  
  .btn-primary {
    @apply bg-primary-600 text-white hover:bg-primary-700;
  }
  
  .btn-secondary {
    @apply bg-gray-100 text-gray-900 hover:bg-gray-200;
  }
}
`;

      const indexCssPath = path.join(srcDir, 'index.css');
      await fs.writeFile(indexCssPath, indexCss);
      files.push({
        path: 'frontend/src/index.css',
        content: indexCss,
        type: 'css',
        lastModified: new Date(),
        size: indexCss.length
      });
    }

    return files;
  }

  private async generateTypes(spec: RequirementSpec, outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const typesDir = path.join(outputDir, 'src', 'types');
    await fs.ensureDir(typesDir);

    let types = `export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  code: string;
  details?: any;
}
`;

    for (const feature of spec.features) {
      if (feature.name.toLowerCase().includes('task') || feature.name.toLowerCase().includes('todo')) {
        types += `
export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}
`;
      }

      if (feature.name.toLowerCase().includes('project')) {
        types += `
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  userId: string;
}
`;
      }
    }

    const typesPath = path.join(typesDir, 'index.ts');
    await fs.writeFile(typesPath, types);
    files.push({
      path: 'frontend/src/types/index.ts',
      content: types,
      type: 'typescript',
      lastModified: new Date(),
      size: types.length
    });

    const mainFile = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
${spec.authentication ? `
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AuthProvider } from './hooks/useAuth';` : ''}
import './index.css';

function App() {
  return (
    ${spec.authentication ? '<AuthProvider>' : ''}
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            ${spec.authentication ? `
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />` : ''}
          </Route>
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    ${spec.authentication ? '</AuthProvider>' : ''}
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

    const mainPath = path.join(outputDir, 'src', 'main.tsx');
    await fs.writeFile(mainPath, mainFile);
    files.push({
      path: 'frontend/src/main.tsx',
      content: mainFile,
      type: 'typescript',
      lastModified: new Date(),
      size: mainFile.length
    });

    return files;
  }
}
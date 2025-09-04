import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { 
  RequirementSpec, 
  Feature, 
  TechStack, 
  APIEndpoint, 
  UIComponent, 
  BusinessRule, 
  FrameworkConfig 
} from '../types';
import { Logger } from '../utils/logger';

export class RequirementsAnalyzer {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private logger: Logger;
  private config: FrameworkConfig;

  constructor(config: FrameworkConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    if (config.aiProvider === 'openai' && config.apiKeys.openai) {
      this.openai = new OpenAI({ apiKey: config.apiKeys.openai });
    }
    
    if (config.aiProvider === 'anthropic' && config.apiKeys.anthropic) {
      this.anthropic = new Anthropic({ apiKey: config.apiKeys.anthropic });
    }
  }

  async analyze(requirements: string): Promise<RequirementSpec> {
    this.logger.info('Analyzing requirements with AI...');
    
    try {
      const analysisPrompt = this.buildAnalysisPrompt(requirements);
      const aiResponse = await this.callAI(analysisPrompt);
      const parsedSpec = this.parseAIResponse(aiResponse);
      
      const enhancedSpec = await this.enhanceSpecification(parsedSpec);
      
      this.logger.info(`Requirements analysis completed. Generated ${enhancedSpec.features.length} features`);
      return enhancedSpec;
    } catch (error) {
      this.logger.error('Requirements analysis failed:', error);
      throw new Error(`Requirements analysis failed: ${error.message}`);
    }
  }

  private buildAnalysisPrompt(requirements: string): string {
    return `
You are an expert software architect. Analyze the following requirements and generate a comprehensive technical specification.

Requirements: "${requirements}"

Please provide a detailed JSON response with the following structure:
{
  "title": "Application Title",
  "description": "Detailed description",
  "features": [
    {
      "name": "Feature Name",
      "description": "Feature description",
      "priority": "high|medium|low",
      "complexity": "simple|moderate|complex",
      "dependencies": ["feature1", "feature2"],
      "acceptance_criteria": ["criteria1", "criteria2"]
    }
  ],
  "techStack": {
    "frontend": {
      "framework": "react|vue|angular",
      "styling": "tailwind|styled-components|css-modules",
      "stateManagement": "redux|zustand|context|none",
      "typescript": true|false
    },
    "backend": {
      "framework": "express|fastify|nest",
      "language": "typescript|javascript",
      "authentication": "jwt|oauth|session|none"
    },
    "database": {
      "type": "postgresql|mongodb|sqlite",
      "database": "app_db"
    },
    "testing": ["jest", "playwright", "cypress"],
    "deployment": ["docker", "vercel", "netlify"]
  },
  "authentication": true|false,
  "database": true|false,
  "realtime": true|false,
  "fileUploads": true|false,
  "notifications": true|false,
  "mobileSupport": true|false,
  "apiEndpoints": [
    {
      "path": "/api/endpoint",
      "method": "GET|POST|PUT|DELETE",
      "description": "Endpoint description",
      "parameters": [
        {
          "name": "param",
          "type": "string|number|boolean|object|array",
          "required": true|false,
          "description": "Parameter description"
        }
      ],
      "response": {
        "type": "object|array",
        "properties": {},
        "status_codes": [200, 400, 500]
      },
      "authentication": true|false,
      "validation": [
        {
          "type": "required|minLength|maxLength|email|regex",
          "value": "validation value",
          "message": "error message"
        }
      ]
    }
  ],
  "uiComponents": [
    {
      "name": "ComponentName",
      "type": "page|component|layout",
      "description": "Component description",
      "props": [
        {
          "name": "prop",
          "type": "string|number|boolean|object|array",
          "required": true|false,
          "description": "Prop description"
        }
      ],
      "children": [],
      "styling": ["responsive", "accessible"],
      "functionality": ["search", "sort", "filter"]
    }
  ],
  "businessLogic": [
    {
      "name": "Business Rule",
      "description": "Rule description",
      "conditions": ["condition1"],
      "actions": ["action1"],
      "priority": 1
    }
  ]
}

Consider:
- Modern web development best practices
- Security requirements
- Performance optimization
- Accessibility standards
- Mobile-first design
- SEO optimization
- Testing strategies
- Scalability needs

Provide only valid JSON without any additional text.
    `;
  }

  private async callAI(prompt: string): Promise<string> {
    if (this.config.aiProvider === 'openai' && this.openai) {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4000
      });
      return response.choices[0]?.message?.content || '';
    }

    if (this.config.aiProvider === 'anthropic' && this.anthropic) {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });
      
      return response.content[0].type === 'text' ? response.content[0].text : '';
    }

    throw new Error(`AI provider ${this.config.aiProvider} not configured properly`);
  }

  private parseAIResponse(response: string): Partial<RequirementSpec> {
    try {
      const cleanResponse = response.replace(/```json\n?/, '').replace(/```\n?$/, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      this.logger.error('Failed to parse AI response:', error);
      this.logger.debug('AI Response:', response);
      
      return this.fallbackParsing(response);
    }
  }

  private fallbackParsing(response: string): Partial<RequirementSpec> {
    this.logger.warn('Using fallback parsing for AI response');
    
    return {
      title: this.extractValue(response, 'title') || 'Generated Application',
      description: this.extractValue(response, 'description') || 'AI-generated application',
      features: this.parseFeatures(response),
      techStack: this.parseTechStack(response),
      authentication: this.extractBoolean(response, 'authentication'),
      database: this.extractBoolean(response, 'database'),
      realtime: this.extractBoolean(response, 'realtime'),
      fileUploads: this.extractBoolean(response, 'fileUploads'),
      notifications: this.extractBoolean(response, 'notifications'),
      mobileSupport: this.extractBoolean(response, 'mobileSupport')
    };
  }

  private extractValue(text: string, key: string): string | null {
    const regex = new RegExp(`"${key}":\\s*"([^"]*)"`, 'i');
    const match = text.match(regex);
    return match ? match[1] : null;
  }

  private extractBoolean(text: string, key: string): boolean {
    const regex = new RegExp(`"${key}":\\s*(true|false)`, 'i');
    const match = text.match(regex);
    return match ? match[1].toLowerCase() === 'true' : false;
  }

  private parseFeatures(response: string): Feature[] {
    const defaultFeatures: Feature[] = [
      {
        id: uuidv4(),
        name: 'User Authentication',
        description: 'User registration and login system',
        priority: 'high',
        complexity: 'moderate',
        dependencies: [],
        acceptance_criteria: ['Users can register', 'Users can login', 'Password validation']
      },
      {
        id: uuidv4(),
        name: 'Main Dashboard',
        description: 'Primary application interface',
        priority: 'high',
        complexity: 'moderate',
        dependencies: ['User Authentication'],
        acceptance_criteria: ['Responsive design', 'Navigation menu', 'User profile access']
      }
    ];

    return defaultFeatures;
  }

  private parseTechStack(response: string): TechStack {
    return {
      frontend: {
        framework: 'react',
        styling: 'tailwind',
        stateManagement: 'zustand',
        typescript: true
      },
      backend: {
        framework: 'express',
        language: 'typescript',
        authentication: 'jwt'
      },
      database: {
        type: 'postgresql',
        database: 'app_db'
      },
      testing: ['jest', 'playwright'],
      deployment: ['docker']
    };
  }

  private async enhanceSpecification(spec: Partial<RequirementSpec>): Promise<RequirementSpec> {
    const id = uuidv4();
    
    const enhancedSpec: RequirementSpec = {
      id,
      title: spec.title || 'Generated Application',
      description: spec.description || 'AI-generated web application',
      features: spec.features || this.parseFeatures(''),
      techStack: spec.techStack || this.parseTechStack(''),
      authentication: spec.authentication || false,
      database: spec.database || false,
      realtime: spec.realtime || false,
      fileUploads: spec.fileUploads || false,
      notifications: spec.notifications || false,
      mobileSupport: spec.mobileSupport || false,
      apiEndpoints: spec.apiEndpoints || await this.generateAPIEndpoints(spec.features || []),
      uiComponents: spec.uiComponents || await this.generateUIComponents(spec.features || []),
      businessLogic: spec.businessLogic || await this.generateBusinessLogic(spec.features || [])
    };

    enhancedSpec.features = enhancedSpec.features.map(feature => ({
      ...feature,
      id: feature.id || uuidv4()
    }));

    return enhancedSpec;
  }

  private async generateAPIEndpoints(features: Feature[]): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];

    for (const feature of features) {
      if (feature.name.toLowerCase().includes('auth')) {
        endpoints.push(
          {
            path: '/api/auth/register',
            method: 'POST',
            description: 'User registration',
            parameters: [
              {
                name: 'email',
                type: 'string',
                required: true,
                description: 'User email address'
              },
              {
                name: 'password',
                type: 'string',
                required: true,
                description: 'User password'
              }
            ],
            response: {
              type: 'object',
              properties: { user: {}, token: '' },
              status_codes: [201, 400, 409]
            },
            authentication: false,
            validation: [
              { type: 'email', message: 'Invalid email format' },
              { type: 'minLength', value: 8, message: 'Password must be at least 8 characters' }
            ]
          },
          {
            path: '/api/auth/login',
            method: 'POST',
            description: 'User login',
            parameters: [
              {
                name: 'email',
                type: 'string',
                required: true,
                description: 'User email'
              },
              {
                name: 'password',
                type: 'string',
                required: true,
                description: 'User password'
              }
            ],
            response: {
              type: 'object',
              properties: { user: {}, token: '' },
              status_codes: [200, 401]
            },
            authentication: false,
            validation: [
              { type: 'required', message: 'Email is required' },
              { type: 'required', message: 'Password is required' }
            ]
          }
        );
      }

      if (feature.name.toLowerCase().includes('profile')) {
        endpoints.push({
          path: '/api/profile',
          method: 'GET',
          description: 'Get user profile',
          parameters: [],
          response: {
            type: 'object',
            properties: { user: {} },
            status_codes: [200, 401]
          },
          authentication: true,
          validation: []
        });
      }
    }

    return endpoints;
  }

  private async generateUIComponents(features: Feature[]): Promise<UIComponent[]> {
    const components: UIComponent[] = [
      {
        name: 'Layout',
        type: 'layout',
        description: 'Main application layout',
        props: [
          {
            name: 'children',
            type: 'object',
            required: true,
            description: 'Page content'
          }
        ],
        children: [],
        styling: ['responsive', 'accessible'],
        functionality: ['navigation', 'theme-toggle']
      },
      {
        name: 'HomePage',
        type: 'page',
        description: 'Application home page',
        props: [],
        children: [],
        styling: ['responsive', 'hero-section'],
        functionality: ['navigation']
      }
    ];

    for (const feature of features) {
      if (feature.name.toLowerCase().includes('auth')) {
        components.push(
          {
            name: 'LoginForm',
            type: 'component',
            description: 'User login form',
            props: [
              {
                name: 'onSubmit',
                type: 'object',
                required: true,
                description: 'Form submit handler'
              }
            ],
            children: [],
            styling: ['form-validation', 'responsive'],
            functionality: ['validation', 'submit']
          },
          {
            name: 'RegisterForm',
            type: 'component',
            description: 'User registration form',
            props: [
              {
                name: 'onSubmit',
                type: 'object',
                required: true,
                description: 'Form submit handler'
              }
            ],
            children: [],
            styling: ['form-validation', 'responsive'],
            functionality: ['validation', 'submit']
          }
        );
      }

      if (feature.name.toLowerCase().includes('dashboard')) {
        components.push({
          name: 'Dashboard',
          type: 'page',
          description: 'Main dashboard page',
          props: [
            {
              name: 'user',
              type: 'object',
              required: true,
              description: 'Current user data'
            }
          ],
          children: [],
          styling: ['grid-layout', 'responsive'],
          functionality: ['data-display', 'navigation']
        });
      }
    }

    return components;
  }

  private async generateBusinessLogic(features: Feature[]): Promise<BusinessRule[]> {
    const rules: BusinessRule[] = [];

    for (const feature of features) {
      if (feature.name.toLowerCase().includes('auth')) {
        rules.push({
          id: uuidv4(),
          name: 'Password Strength',
          description: 'Enforce strong password requirements',
          conditions: ['password length >= 8', 'contains uppercase', 'contains lowercase', 'contains number'],
          actions: ['validate password', 'show strength indicator'],
          priority: 1
        });
      }

      if (feature.name.toLowerCase().includes('user') || feature.name.toLowerCase().includes('profile')) {
        rules.push({
          id: uuidv4(),
          name: 'User Data Privacy',
          description: 'Protect user personal information',
          conditions: ['user is authenticated', 'accessing own data'],
          actions: ['authorize access', 'log activity'],
          priority: 1
        });
      }
    }

    return rules;
  }
}
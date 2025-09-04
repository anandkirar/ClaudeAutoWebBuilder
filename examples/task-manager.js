#!/usr/bin/env node

/**
 * Example: Task Management Application
 * 
 * This example demonstrates how to use the Autonomous Web Framework
 * to create a complete task management application with user authentication,
 * real-time updates, and mobile support.
 */

const path = require('path');
const fs = require('fs-extra');

// Import the framework
const { AutonomousWebFramework } = require('../dist/index.js');

async function createTaskManagerApp() {
  console.log('🤖 Autonomous Web Framework - Task Manager Example');
  console.log('===================================================\n');

  try {
    // Initialize the framework
    console.log('📋 Initializing framework...');
    const framework = new AutonomousWebFramework({
      aiProvider: process.env.FRAMEWORK_AI_PROVIDER || 'openai',
      apiKeys: {
        openai: process.env.OPENAI_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY
      },
      workspaceDir: path.join(__dirname, '../workspace'),
      database: {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'taskmanager_db',
        username: 'postgres',
        password: 'password'
      },
      deployment: {
        provider: 'docker',
        environment: 'development',
        autoScale: false,
        healthChecks: true,
        rollbackOnFailure: true
      },
      monitoring: {
        enableRealTime: true,
        errorTracking: true,
        performanceMetrics: true,
        userAnalytics: false,
        alertWebhooks: []
      },
      testing: {
        unitTests: true,
        integrationTests: true,
        e2eTests: true,
        visualRegression: false,
        performanceTesting: false,
        accessibility: true,
        autoFix: true
      },
      healing: {
        autoFix: true,
        retryAttempts: 3,
        rollbackThreshold: 2,
        learningMode: true,
        notifyOnFix: true
      },
      logLevel: 'info'
    });

    // Start the framework
    console.log('🚀 Starting framework...');
    await framework.start();
    console.log('✅ Framework started successfully!\n');

    // Define the application requirements
    const requirements = `
      Create a comprehensive task management application with the following features:

      **Core Features:**
      - User registration and authentication with email verification
      - Create, edit, delete, and mark tasks as complete/incomplete
      - Task categories (Work, Personal, Shopping, etc.)
      - Task priorities (High, Medium, Low) with visual indicators
      - Due dates and deadline notifications
      - Task descriptions with rich text formatting
      - File attachments for tasks (images, documents)
      - Task search and filtering capabilities
      - Bulk task operations (delete, complete, move)

      **Advanced Features:**
      - Real-time collaboration - share tasks with other users
      - Task comments and activity history
      - Subtasks and task dependencies
      - Recurring tasks (daily, weekly, monthly)
      - Task templates for common workflows
      - Time tracking for tasks
      - Productivity analytics and reports
      - Task export to PDF or CSV

      **User Experience:**
      - Clean, modern, mobile-responsive design
      - Dark mode and light mode toggle
      - Keyboard shortcuts for power users
      - Drag-and-drop task reordering
      - Offline support with sync when online
      - Push notifications for deadlines
      - Customizable dashboard views

      **Technical Requirements:**
      - Secure user authentication with password reset
      - Real-time updates using WebSockets
      - File upload with virus scanning
      - Email notifications for task updates
      - API for third-party integrations
      - Mobile app support (responsive design)
      - Performance optimized for large task lists
      - Comprehensive error handling and logging

      **Integration Features:**
      - Calendar integration (Google Calendar, Outlook)
      - Email task creation (forward emails to create tasks)
      - Slack/Discord notifications
      - GitHub issue integration
      - Time tracking tool integration

      The application should be production-ready with proper security,
      performance optimization, comprehensive testing, and deployment automation.
    `;

    // Create the application
    console.log('🏗️  Creating task management application...');
    console.log('📝 Analyzing requirements with AI...');
    
    const app = await framework.createApp(requirements);
    
    console.log(`\n✅ Application created successfully!`);
    console.log(`📱 Name: ${app.name}`);
    console.log(`🆔 ID: ${app.id}`);
    console.log(`📍 Status: ${app.status.message}`);
    console.log(`📂 Location: ${path.join(framework.config.workspaceDir, 'apps', app.id)}`);

    // Display generated features
    console.log('\n🎯 Generated Features:');
    app.specification.features.forEach((feature, index) => {
      console.log(`  ${index + 1}. ${feature.name} (${feature.priority} priority)`);
      console.log(`     ${feature.description}`);
    });

    // Display tech stack
    console.log('\n💻 Tech Stack:');
    console.log(`  Frontend: ${app.specification.techStack.frontend.framework} with ${app.specification.techStack.frontend.styling}`);
    console.log(`  Backend: ${app.specification.techStack.backend.framework} (${app.specification.techStack.backend.language})`);
    console.log(`  Database: ${app.specification.techStack.database.type}`);
    console.log(`  Authentication: ${app.specification.techStack.backend.authentication}`);

    // Display API endpoints
    console.log('\n🔌 API Endpoints:');
    app.specification.apiEndpoints.slice(0, 5).forEach(endpoint => {
      console.log(`  ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
    });
    if (app.specification.apiEndpoints.length > 5) {
      console.log(`  ... and ${app.specification.apiEndpoints.length - 5} more endpoints`);
    }

    // Run comprehensive tests
    console.log('\n🧪 Running comprehensive tests...');
    await framework.runTests(app.id);
    console.log('✅ Tests completed successfully!');

    // Deploy the application
    console.log('\n🚀 Deploying to development environment...');
    await framework.deployApp(app.id, 'development');
    console.log('✅ Deployment completed successfully!');

    // Show access information
    console.log('\n🌐 Application Access:');
    console.log('  Frontend: http://localhost:3000');
    console.log('  Backend API: http://localhost:3001');
    console.log('  Dashboard: http://localhost:3100');
    console.log('  Database: postgresql://localhost:5432/taskmanager_db');

    // Show next steps
    console.log('\n📋 Next Steps:');
    console.log('  1. Open http://localhost:3000 to view your application');
    console.log('  2. Open http://localhost:3100 to monitor via dashboard');
    console.log('  3. Check the generated code in the workspace directory');
    console.log('  4. Customize the application as needed');
    console.log('  5. Deploy to staging/production when ready');

    // Show framework capabilities
    console.log('\n🤖 Framework Capabilities:');
    console.log('  ✅ Self-healing: Monitors and fixes issues automatically');
    console.log('  ✅ Continuous testing: Runs tests on every change');
    console.log('  ✅ Performance monitoring: Tracks metrics in real-time');
    console.log('  ✅ Security scanning: Checks for vulnerabilities');
    console.log('  ✅ Deployment automation: Zero-downtime deployments');

    console.log('\n🎉 Task Manager application created successfully!');
    console.log('The framework will continue monitoring and improving your application autonomously.');

  } catch (error) {
    console.error('\n❌ Error creating application:', error.message);
    console.error('\nStacktrace:', error.stack);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Run the example
if (require.main === module) {
  createTaskManagerApp().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = createTaskManagerApp;
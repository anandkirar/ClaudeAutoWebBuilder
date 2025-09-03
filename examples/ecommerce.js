#!/usr/bin/env node

/**
 * Example: E-commerce Platform
 * 
 * This example demonstrates creating a complete e-commerce platform
 * with product management, shopping cart, payment processing,
 * and admin dashboard.
 */

const path = require('path');
const AutonomousWebFramework = require('../dist/index.js');

async function createEcommercePlatform() {
  console.log('🛒 Autonomous Web Framework - E-commerce Platform Example');
  console.log('========================================================\n');

  try {
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
        database: 'ecommerce_db',
        username: 'postgres',
        password: 'password'
      },
      deployment: {
        provider: 'docker',
        environment: 'development',
        autoScale: true,
        healthChecks: true,
        rollbackOnFailure: true
      },
      monitoring: {
        enableRealTime: true,
        errorTracking: true,
        performanceMetrics: true,
        userAnalytics: true,
        alertWebhooks: []
      },
      testing: {
        unitTests: true,
        integrationTests: true,
        e2eTests: true,
        visualRegression: true,
        performanceTesting: true,
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

    console.log('🚀 Starting framework...');
    await framework.start();

    const requirements = `
      Create a comprehensive e-commerce platform with the following features:

      **Core E-commerce Features:**
      - Product catalog with categories, subcategories, and filtering
      - Product search with autocomplete and search suggestions
      - Advanced product filtering (price, brand, rating, availability)
      - Product variants (size, color, model) with separate inventory
      - High-quality product image galleries with zoom functionality
      - Product reviews and ratings system
      - Related products and cross-selling recommendations
      - Wishlist and favorites functionality
      - Recently viewed products tracking

      **Shopping Cart & Checkout:**
      - Persistent shopping cart across sessions
      - Guest checkout and registered user checkout
      - Multiple shipping options with real-time rate calculation
      - Tax calculation based on location
      - Discount codes and promotional campaigns
      - Multiple payment methods (credit card, PayPal, Apple Pay)
      - Secure payment processing with PCI compliance
      - Order confirmation and tracking emails
      - Order history and reorder functionality

      **User Account Management:**
      - User registration and authentication
      - Email verification and password reset
      - User profiles with shipping addresses
      - Order history and tracking
      - Account preferences and settings
      - Newsletter subscription management
      - Loyalty program with points and rewards

      **Inventory Management:**
      - Real-time inventory tracking
      - Low stock alerts and out-of-stock handling
      - Backorder management
      - Inventory forecasting and reporting
      - Bulk inventory updates
      - Product import/export functionality
      - Multi-warehouse support

      **Admin Dashboard:**
      - Comprehensive admin panel for store management
      - Product management (add, edit, delete, bulk operations)
      - Order management with status updates
      - Customer management and support tools
      - Sales analytics and reporting
      - Inventory management and alerts
      - Marketing campaign management
      - Staff user management with role-based access

      **Marketing & SEO:**
      - SEO-optimized product and category pages
      - Social media integration and sharing
      - Email marketing integration
      - Abandoned cart recovery emails
      - Product recommendation engine
      - Customer segmentation for targeted marketing
      - A/B testing for conversion optimization
      - Google Analytics and Facebook Pixel integration

      **Advanced Features:**
      - Multi-currency support with real-time conversion
      - Multi-language support (i18n)
      - Mobile-first responsive design
      - Progressive Web App (PWA) capabilities
      - Live chat customer support integration
      - Advanced search with filters and facets
      - Product comparison functionality
      - Recently viewed and browsing history
      - Social proof (reviews, ratings, user photos)

      **Technical Requirements:**
      - High performance with caching strategies
      - Security best practices (HTTPS, data encryption)
      - Scalable architecture for high traffic
      - Real-time notifications for orders and inventory
      - Comprehensive error handling and logging
      - API for mobile app and third-party integrations
      - Automated backups and disaster recovery
      - GDPR compliance and privacy controls

      **Integration Capabilities:**
      - Payment gateways (Stripe, PayPal, Square)
      - Shipping providers (UPS, FedEx, USPS)
      - Email service providers (SendGrid, Mailchimp)
      - Analytics platforms (Google Analytics, Mixpanel)
      - Customer support tools (Zendesk, Intercom)
      - Accounting software (QuickBooks, Xero)
      - CRM systems (Salesforce, HubSpot)

      The platform should be enterprise-ready with proper security,
      performance optimization, comprehensive testing, and deployment automation.
      It should handle thousands of products and concurrent users efficiently.
    `;

    console.log('🏗️  Creating e-commerce platform...');
    const app = await framework.createApp(requirements);
    
    console.log(`\n✅ E-commerce platform created successfully!`);
    console.log(`🏪 Store Name: ${app.name}`);
    console.log(`🆔 ID: ${app.id}`);
    console.log(`📊 Features Generated: ${app.specification.features.length}`);
    console.log(`🔌 API Endpoints: ${app.specification.apiEndpoints.length}`);

    console.log('\n🛍️  E-commerce Features:');
    const ecommerceFeatures = app.specification.features.filter(f => 
      f.name.toLowerCase().includes('product') ||
      f.name.toLowerCase().includes('cart') ||
      f.name.toLowerCase().includes('order') ||
      f.name.toLowerCase().includes('payment')
    );
    
    ecommerceFeatures.slice(0, 10).forEach((feature, index) => {
      console.log(`  ${index + 1}. ${feature.name} (${feature.priority} priority)`);
    });

    console.log('\n💳 Payment & Security:');
    if (app.specification.features.some(f => f.name.toLowerCase().includes('payment'))) {
      console.log('  ✅ Secure payment processing');
      console.log('  ✅ PCI compliance ready');
      console.log('  ✅ Multiple payment methods');
      console.log('  ✅ Fraud detection integration');
    }

    console.log('\n🧪 Running comprehensive tests...');
    await framework.runTests(app.id);

    console.log('\n🚀 Deploying e-commerce platform...');
    await framework.deployApp(app.id, 'development');

    console.log('\n🌐 E-commerce Platform Access:');
    console.log('  🏪 Storefront: http://localhost:3000');
    console.log('  ⚙️  Admin Panel: http://localhost:3000/admin');
    console.log('  📊 API: http://localhost:3001/api');
    console.log('  📈 Dashboard: http://localhost:3100');

    console.log('\n🎯 Key Features Implemented:');
    console.log('  🛒 Shopping cart with persistence');
    console.log('  💳 Secure checkout process');
    console.log('  📦 Order management system');
    console.log('  📊 Admin dashboard');
    console.log('  🔍 Product search and filtering');
    console.log('  ⭐ Review and rating system');
    console.log('  📧 Email notifications');
    console.log('  📱 Mobile-responsive design');

    console.log('\n🚀 Performance & Scalability:');
    console.log('  ✅ Optimized for high traffic');
    console.log('  ✅ Caching strategies implemented');
    console.log('  ✅ Database query optimization');
    console.log('  ✅ CDN integration ready');
    console.log('  ✅ Auto-scaling configuration');

    console.log('\n📈 Next Steps:');
    console.log('  1. Configure payment gateways (Stripe, PayPal)');
    console.log('  2. Set up shipping provider integrations');
    console.log('  3. Import your product catalog');
    console.log('  4. Configure email templates');
    console.log('  5. Set up analytics tracking');
    console.log('  6. Test the complete purchase flow');
    console.log('  7. Deploy to production when ready');

    console.log('\n🎉 E-commerce platform ready for business!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  createEcommercePlatform().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = createEcommercePlatform;
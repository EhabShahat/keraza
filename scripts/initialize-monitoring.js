#!/usr/bin/env node

/**
 * Initialize Function Monitoring System
 * Sets up health monitoring and alerting for consolidated functions
 */

const { initializeMonitoring } = require('../src/lib/monitoring/monitoring-init');

async function main() {
  console.log('🚀 Starting monitoring system initialization...');

  try {
    // Configuration from environment variables
    const config = {
      enabled: process.env.MONITORING_ENABLED !== 'false',
      functions: {
        admin: process.env.MONITOR_ADMIN_API !== 'false',
        public: process.env.MONITOR_PUBLIC_API !== 'false',
        attempts: process.env.MONITOR_ATTEMPTS_API !== 'false'
      },
      alerting: {
        enabled: process.env.ALERTING_ENABLED !== 'false',
        channels: {
          console: true,
          webhook: process.env.ALERT_WEBHOOK_URL,
          slack: process.env.ALERT_SLACK_WEBHOOK
        }
      },
      intervals: {
        healthCheck: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30,
        metricsCollection: parseInt(process.env.METRICS_COLLECTION_INTERVAL) || 60,
        alertEvaluation: parseInt(process.env.ALERT_EVALUATION_INTERVAL) || 30
      }
    };

    console.log('📋 Configuration:', JSON.stringify(config, null, 2));

    // Initialize monitoring
    const monitoring = await initializeMonitoring(config);
    
    console.log('✅ Monitoring system initialized successfully');
    console.log('📊 Status:', monitoring.getStatus());

    // Keep the process running if this is the main module
    if (require.main === module) {
      console.log('🔄 Monitoring system running... Press Ctrl+C to stop');
      
      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down monitoring system...');
        monitoring.shutdown();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down monitoring system...');
        monitoring.shutdown();
        process.exit(0);
      });

      // Keep process alive
      setInterval(() => {
        const status = monitoring.getStatus();
        console.log(`📈 Status: ${status.health_statuses.length} functions monitored, ${status.active_alerts.length} active alerts`);
      }, 60000); // Log status every minute
    }

  } catch (error) {
    console.error('❌ Failed to initialize monitoring system:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };
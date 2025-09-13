#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Checks if the deployed application is working correctly
 */

const https = require('https');
const http = require('http');

/**
 * Make HTTP request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const startTime = Date.now();
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Deployment-Verification-Script',
        'Accept': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed,
            responseTime,
            raw: data
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            responseTime,
            raw: data
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

/**
 * Test endpoint
 */
async function testEndpoint(baseUrl, path, expectedStatus = 200, description = '') {
  const url = `${baseUrl}${path}`;
  
  try {
    console.log(`Testing: ${description || path}`);
    const response = await makeRequest(url);
    
    const success = response.status === expectedStatus;
    const statusIcon = success ? '✅' : '❌';
    
    console.log(`  ${statusIcon} ${response.status} (${response.responseTime}ms)`);
    
    if (!success) {
      console.log(`  Expected: ${expectedStatus}, Got: ${response.status}`);
      if (response.data && typeof response.data === 'object') {
        console.log(`  Error: ${JSON.stringify(response.data, null, 2)}`);
      }
    }
    
    return success;
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Test health endpoints
 */
async function testHealthEndpoints(baseUrl) {
  console.log('\n🏥 Testing Health Endpoints...');
  
  const tests = [
    ['/api/public/health', 200, 'Public API Health'],
    ['/api/admin/health', 200, 'Admin API Health'],
    ['/api/attempts/health', 200, 'Attempts API Health']
  ];
  
  let passed = 0;
  
  for (const [path, expectedStatus, description] of tests) {
    const success = await testEndpoint(baseUrl, path, expectedStatus, description);
    if (success) passed++;
  }
  
  return { passed, total: tests.length };
}

/**
 * Test public endpoints
 */
async function testPublicEndpoints(baseUrl) {
  console.log('\n🌐 Testing Public Endpoints...');
  
  const tests = [
    ['/', 200, 'Home Page'],
    ['/api/public/system-mode', 200, 'System Mode'],
    ['/api/public/settings', 200, 'App Settings'],
    ['/api/public/code-settings', 200, 'Code Settings']
  ];
  
  let passed = 0;
  
  for (const [path, expectedStatus, description] of tests) {
    const success = await testEndpoint(baseUrl, path, expectedStatus, description);
    if (success) passed++;
  }
  
  return { passed, total: tests.length };
}

/**
 * Test admin endpoints (should require auth)
 */
async function testAdminEndpoints(baseUrl) {
  console.log('\n🔐 Testing Admin Endpoints (should require auth)...');
  
  const tests = [
    ['/admin', 302, 'Admin Dashboard (redirect to login)'],
    ['/admin/login', 200, 'Admin Login Page'],
    ['/api/admin/whoami', 401, 'Admin Auth Check (unauthorized)']
  ];
  
  let passed = 0;
  
  for (const [path, expectedStatus, description] of tests) {
    const success = await testEndpoint(baseUrl, path, expectedStatus, description);
    if (success) passed++;
  }
  
  return { passed, total: tests.length };
}

/**
 * Test bootstrap endpoint
 */
async function testBootstrap(baseUrl) {
  console.log('\n🚀 Testing Bootstrap Endpoint...');
  
  try {
    const response = await makeRequest(`${baseUrl}/api/admin/bootstrap`, {
      method: 'GET'
    });
    
    const success = response.status === 200;
    const statusIcon = success ? '✅' : '❌';
    
    console.log(`  ${statusIcon} Bootstrap Status: ${response.status}`);
    
    if (success && response.data) {
      console.log(`  Setup Required: ${response.data.setup_required ? 'Yes' : 'No'}`);
      console.log(`  Admin Count: ${response.data.admin_count || 0}`);
    }
    
    return success;
  } catch (error) {
    console.log(`  ❌ Bootstrap Error: ${error.message}`);
    return false;
  }
}

/**
 * Main verification function
 */
async function verifyDeployment() {
  const baseUrl = process.argv[2];
  
  if (!baseUrl) {
    console.error('Usage: node scripts/verify-deployment.js <base-url>');
    console.error('Example: node scripts/verify-deployment.js https://your-app.netlify.app');
    process.exit(1);
  }
  
  console.log(`🔍 Verifying deployment at: ${baseUrl}`);
  console.log('=' .repeat(60));
  
  const results = {
    health: await testHealthEndpoints(baseUrl),
    public: await testPublicEndpoints(baseUrl),
    admin: await testAdminEndpoints(baseUrl),
    bootstrap: await testBootstrap(baseUrl)
  };
  
  // Summary
  console.log('\n📊 Verification Summary');
  console.log('=' .repeat(60));
  
  const totalPassed = results.health.passed + results.public.passed + results.admin.passed + (results.bootstrap ? 1 : 0);
  const totalTests = results.health.total + results.public.total + results.admin.total + 1;
  
  console.log(`Health Endpoints: ${results.health.passed}/${results.health.total}`);
  console.log(`Public Endpoints: ${results.public.passed}/${results.public.total}`);
  console.log(`Admin Endpoints: ${results.admin.passed}/${results.admin.total}`);
  console.log(`Bootstrap: ${results.bootstrap ? '1/1' : '0/1'}`);
  console.log('-'.repeat(30));
  console.log(`Total: ${totalPassed}/${totalTests} tests passed`);
  
  const successRate = (totalPassed / totalTests) * 100;
  const overallIcon = successRate >= 80 ? '✅' : successRate >= 60 ? '⚠️' : '❌';
  
  console.log(`${overallIcon} Success Rate: ${successRate.toFixed(1)}%`);
  
  if (successRate >= 80) {
    console.log('\n🎉 Deployment verification successful!');
    
    if (results.bootstrap && results.public.passed === results.public.total) {
      console.log('\n📝 Next Steps:');
      console.log('1. Create your first admin user using the bootstrap endpoint');
      console.log('2. Log in to the admin panel and configure your settings');
      console.log('3. Set up your database schema if not already done');
      console.log('4. Create your first exam to test functionality');
    }
    
    process.exit(0);
  } else {
    console.log('\n⚠️ Deployment verification found issues.');
    console.log('Please check the failed endpoints and resolve any issues.');
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

// Run verification
verifyDeployment().catch(console.error);
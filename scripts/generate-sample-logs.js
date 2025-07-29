#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Sample data for generating realistic logs
const services = [
  'api-gateway@http',
  'auth-service@http',
  'user-service@http',
  'product-service@http',
  'order-service@http',
  'payment-service@http',
  'notification-service@http',
  'search-service@http'
];

const routers = [
  'api-router@http',
  'web-router@http',
  'admin-router@http',
  'mobile-router@http',
  'webhook-router@http'
];

const paths = [
  '/api/v1/users',
  '/api/v1/users/123',
  '/api/v1/products',
  '/api/v1/products/search',
  '/api/v1/orders',
  '/api/v1/orders/123/status',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/health',
  '/metrics',
  '/api/v1/notifications',
  '/api/v1/payments/process',
  '/webhooks/stripe',
  '/admin/dashboard',
  '/static/css/main.css',
  '/static/js/app.js',
  '/favicon.ico'
];

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
  'Mozilla/5.0 (Android 11; Mobile; rv:89.0) Gecko/89.0 Firefox/89.0',
  'PostmanRuntime/7.28.4',
  'curl/7.68.0',
  'axios/0.27.2'
];

const ips = [
  '192.168.1.100',
  '10.0.0.50',
  '172.16.0.20',
  '203.0.113.45',
  '198.51.100.78',
  '192.0.2.123',
  '::1',
  '2001:db8::1'
];

const hosts = [
  'api.example.com',
  'app.example.com',
  'admin.example.com',
  'example.com',
  'localhost'
];

// Generate random log entry
function generateLogEntry() {
  const timestamp = new Date().toISOString();
  const service = services[Math.floor(Math.random() * services.length)];
  const router = routers[Math.floor(Math.random() * routers.length)];
  const path = paths[Math.floor(Math.random() * paths.length)];
  const method = methods[Math.floor(Math.random() * methods.length)];
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  const ip = ips[Math.floor(Math.random() * ips.length)];
  const host = hosts[Math.floor(Math.random() * hosts.length)];
  
  // Generate realistic status codes (mostly 200s)
  let status;
  const rand = Math.random();
  if (rand < 0.7) status = 200;
  else if (rand < 0.8) status = 201;
  else if (rand < 0.85) status = 304;
  else if (rand < 0.9) status = 404;
  else if (rand < 0.94) status = 400;
  else if (rand < 0.97) status = 401;
  else if (rand < 0.99) status = 500;
  else status = 503;
  
  // Generate realistic response times
  let duration;
  if (path.includes('/static/')) {
    duration = Math.random() * 0.01; // Static files: 0-10ms
  } else if (path === '/health') {
    duration = Math.random() * 0.005; // Health checks: 0-5ms
  } else if (method === 'GET') {
    duration = Math.random() * 0.2; // GET requests: 0-200ms
  } else {
    duration = Math.random() * 0.5 + 0.05; // POST/PUT/DELETE: 50-550ms
  }
  
  const size = Math.floor(Math.random() * 50000) + 200; // 200B - 50KB
  
  const log = {
    time: timestamp,
    ServiceName: service,
    RouterName: router,
    RequestMethod: method,
    RequestPath: path,
    RequestHost: host,
    DownstreamStatus: status,
    Duration: duration,
    DownstreamContentSize: size,
    ClientAddr: `${ip}:${Math.floor(Math.random() * 50000) + 10000}`,
    'request_User-Agent': userAgent,
    RequestProtocol: 'HTTP/1.1',
    EntryPointName: 'web',
    RequestScheme: 'https'
  };
  
  return JSON.stringify(log);
}

// Main function
function main() {
  const args = process.argv.slice(2);
  const outputFile = args[0] || 'logs/traefik.log';
  const count = parseInt(args[1]) || 100;
  const continuous = args[2] === '--continuous';
  
  // Ensure directory exists
  const dir = path.dirname(outputFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  console.log(`Generating ${continuous ? 'continuous' : count} log entries to ${outputFile}`);
  
  if (continuous) {
    // Continuous mode - generate logs in real-time
    const stream = fs.createWriteStream(outputFile, { flags: 'a' });
    
    const generateAndWrite = () => {
      const entry = generateLogEntry();
      stream.write(entry + '\n');
      console.log('Generated log entry');
      
      // Random delay between 100ms and 2s
      const delay = Math.random() * 1900 + 100;
      setTimeout(generateAndWrite, delay);
    };
    
    generateAndWrite();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nStopping log generation...');
      stream.end();
      process.exit(0);
    });
  } else {
    // Batch mode - generate fixed number of logs
    const logs = [];
    for (let i = 0; i < count; i++) {
      logs.push(generateLogEntry());
    }
    
    fs.writeFileSync(outputFile, logs.join('\n') + '\n');
    console.log(`Generated ${count} log entries`);
  }
}

main();
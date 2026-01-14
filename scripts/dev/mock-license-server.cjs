/**
 * Mock License API Server for Development
 * 
 * Usage:
 *   node scripts/dev/mock-license-server.cjs
 * 
 * Or via npm script:
 *   pnpm dev:license-server
 * 
 * Test license key: NEKO-TEST-1234-5678
 * Test GitHub user: testuser
 */

const http = require('http');

const PORT = 8787;

// In-memory license database (GitHub account binding mode)
const licenses = {
  'NEKO-TEST-1234-5678': {
    github_username: 'testuser',
    email: 'test@example.com',
    expires_at: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    status: 'active'
  },
  'NEKO-DEMO-AAAA-BBBB': {
    github_username: null, // Unbound
    email: null,
    expires_at: null,
    duration: 365 * 24 * 60 * 60 * 1000,
    status: 'active'
  }
};

function log(method, url, status, message = '') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${method} ${url} -> ${status} ${message}`);
}

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body || '{}');

      // POST /check_pro - Check PRO status
      if (req.url === '/check_pro') {
        const { github_username } = data;
        
        // Find license bound to this GitHub user
        const license = Object.values(licenses).find(
          l => l.github_username?.toLowerCase() === github_username?.toLowerCase() && l.status === 'active'
        );
        
        if (!license) {
          log(req.method, req.url, 200, `user=${github_username} isPro=false`);
          res.end(JSON.stringify({ success: true, isPro: false }));
          return;
        }
        
        // Check if expired
        if (license.expires_at && license.expires_at < Date.now()) {
          log(req.method, req.url, 200, `user=${github_username} isPro=false (expired)`);
          res.end(JSON.stringify({ success: true, isPro: false, reason: 'EXPIRED' }));
          return;
        }
        
        const key = Object.keys(licenses).find(k => licenses[k] === license);
        log(req.method, req.url, 200, `user=${github_username} isPro=true`);
        res.end(JSON.stringify({ 
          success: true, 
          isPro: true, 
          licenseKey: key,
          expiresAt: license.expires_at 
        }));
      }
      // POST /bind_license - Bind license to GitHub account
      else if (req.url === '/bind_license') {
        const { license_key, github_username } = data;
        const license = licenses[license_key?.toUpperCase()];
        
        if (!license) {
          log(req.method, req.url, 400, 'INVALID_KEY');
          res.end(JSON.stringify({ success: false, error_code: 'INVALID_KEY' }));
          return;
        }
        
        if (license.status === 'revoked') {
          log(req.method, req.url, 400, 'REVOKED');
          res.end(JSON.stringify({ success: false, error_code: 'REVOKED' }));
          return;
        }
        
        if (license.github_username && license.github_username.toLowerCase() !== github_username?.toLowerCase()) {
          log(req.method, req.url, 400, 'ALREADY_BOUND');
          res.end(JSON.stringify({ success: false, error_code: 'ALREADY_BOUND' }));
          return;
        }
        
        // Bind
        license.github_username = github_username?.toLowerCase();
        if (license.duration && !license.expires_at) {
          license.expires_at = Date.now() + license.duration;
        }
        
        log(req.method, req.url, 200, `key=${license_key} -> ${github_username}`);
        res.end(JSON.stringify({ success: true, expiresAt: license.expires_at }));
      }
      else {
        log(req.method, req.url, 404, 'Not found');
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (err) {
      log(req.method, req.url, 500, err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(50));
  console.log('  Mock License API Server (GitHub Binding Mode)');
  console.log('='.repeat(50));
  console.log(`  Running on: http://localhost:${PORT}`);
  console.log('');
  console.log('  Test data:');
  console.log('    License: NEKO-TEST-1234-5678 -> testuser');
  console.log('    License: NEKO-DEMO-AAAA-BBBB -> (unbound)');
  console.log('');
  console.log('  Endpoints:');
  console.log('    POST /check_pro    - Check PRO status by GitHub username');
  console.log('    POST /bind_license - Bind license to GitHub account');
  console.log('='.repeat(50));
  console.log('');
});

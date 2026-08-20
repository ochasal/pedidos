/**
 * Servidor de desarrollo local
 * Simula Vercel: sirve archivos estáticos + serverless functions
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Cargar .env
require('dotenv').config();

const PORT = 3000;

// MIME types
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  try {
    // API routes
    if (pathname.startsWith('/api/')) {
      await handleAPI(req, res, pathname);
      return;
    }

    // Static assets
    if (pathname.startsWith('/assets/')) {
      serveStatic(res, path.join(__dirname, 'public', pathname));
      return;
    }

    // Platform admin
    if (pathname.startsWith('/platform')) {
      serveStatic(res, path.join(__dirname, 'public', 'platform', 'index.html'));
      return;
    }

    // Root
    if (pathname === '/' || pathname === '') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html><body style="font-family:sans-serif;padding:2rem;text-align:center;">
          <h1>Plataforma de Pedidos</h1>
          <p>Selecciona un acceso:</p>
          <ul style="list-style:none;padding:0;">
            <li style="margin:1rem"><a href="/platform">🔑 Panel Super-Admin</a></li>
            <li style="margin:1rem"><a href="/pastelven">🛍️ Tienda Pastelven</a></li>
            <li style="margin:1rem"><a href="/pastelven/admin">⚙️ Admin Pastelven</a></li>
          </ul>
        </body></html>
      `);
      return;
    }

    // Tenant routes: /{slug}/admin → admin panel
    const adminMatch = pathname.match(/^\/([^/]+)\/admin/);
    if (adminMatch) {
      serveStatic(res, path.join(__dirname, 'public', 'admin', 'index.html'));
      return;
    }

    // Tenant routes: /{slug}/pedido/{token} → tracking
    const trackingMatch = pathname.match(/^\/([^/]+)\/pedido\//);
    if (trackingMatch) {
      serveStatic(res, path.join(__dirname, 'public', 'tracking', 'index.html'));
      return;
    }

    // Tenant routes: /{slug} → store
    const tenantMatch = pathname.match(/^\/([^/]+)/);
    if (tenantMatch) {
      serveStatic(res, path.join(__dirname, 'public', 'store', 'index.html'));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

// Serve static files
function serveStatic(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
}

// Handle API routes
async function handleAPI(req, res, pathname) {
  // Parse body for POST/PUT/PATCH
  let body = '';
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    body = await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
    });
    try { req.body = JSON.parse(body); } catch { req.body = {}; }
  }

  // Resolve the serverless function file
  const functionPath = resolveFunction(pathname);
  if (!functionPath) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `API route not found: ${pathname}` }));
    return;
  }

  // Clear require cache for hot reload
  delete require.cache[require.resolve(functionPath)];

  const handler = require(functionPath);
  
  // Create a mock res object compatible with Vercel
  const mockRes = {
    statusCode: 200,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(data) {
      res.writeHead(this.statusCode, { 'Content-Type': 'application/json', ...this.headers });
      res.end(JSON.stringify(data));
    },
    send(data) {
      res.writeHead(this.statusCode, this.headers);
      res.end(data);
    },
    end(data) {
      res.writeHead(this.statusCode, this.headers);
      res.end(data || '');
    }
  };

  // Set req.url to the full path with query
  req.url = pathname + (parsedUrl(req).search || '');

  await handler(req, mockRes);
}

function parsedUrl(req) {
  return url.parse(req.url, true);
}

// Resolve API path to file
function resolveFunction(pathname) {
  // Remove /api/ prefix
  let routePath = pathname.replace(/^\/api\//, '');
  const parts = routePath.split('/').filter(Boolean);

  // Try exact match first
  let filePath = path.join(__dirname, 'api', ...parts) + '.js';
  if (fs.existsSync(filePath)) return filePath;

  // Try index.js
  filePath = path.join(__dirname, 'api', ...parts, 'index.js');
  if (fs.existsSync(filePath)) return filePath;

  // Try dynamic routes [param]
  return resolveDynamic(parts, path.join(__dirname, 'api'));
}

function resolveDynamic(parts, basePath) {
  if (parts.length === 0) {
    // Check index.js
    const indexPath = path.join(basePath, 'index.js');
    if (fs.existsSync(indexPath)) return indexPath;
    return null;
  }

  const [current, ...rest] = parts;
  
  // Try exact match
  const exactDir = path.join(basePath, current);
  if (fs.existsSync(exactDir) && fs.statSync(exactDir).isDirectory()) {
    const result = resolveDynamic(rest, exactDir);
    if (result) return result;
  }

  // Try exact file
  const exactFile = path.join(basePath, current + '.js');
  if (rest.length === 0 && fs.existsSync(exactFile)) return exactFile;

  // Try dynamic [param] directories
  if (fs.existsSync(basePath)) {
    const entries = fs.readdirSync(basePath);
    for (const entry of entries) {
      if (entry.startsWith('[') && entry.endsWith(']')) {
        const dynDir = path.join(basePath, entry);
        if (fs.statSync(dynDir).isDirectory()) {
          const result = resolveDynamic(rest, dynDir);
          if (result) return result;
        }
      }
      // Dynamic file like [slug].js
      if (entry.startsWith('[') && entry.endsWith('].js') && rest.length === 0) {
        return path.join(basePath, entry);
      }
    }
  }

  return null;
}

server.listen(PORT, () => {
  console.log(`\n🚀 Servidor de desarrollo corriendo en: http://localhost:${PORT}\n`);
  console.log(`   📊 Super-Admin:  http://localhost:${PORT}/platform`);
  console.log(`   🛍️  Tienda:       http://localhost:${PORT}/pastelven`);
  console.log(`   ⚙️  Admin:        http://localhost:${PORT}/pastelven/admin`);
  console.log(`\n   Login: admin@pedidos.test / admin123456\n`);
});

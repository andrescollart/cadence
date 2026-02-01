/**
 * Vite plugin to handle API routes in development
 * Simulates Vercel serverless functions locally
 */
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = __dirname;

// Load environment variables from .env.local
function loadEnvFile() {
  try {
    const envPath = join(PROJECT_ROOT, '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#')) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  } catch {
    console.warn('No .env.local file found');
  }
}

export default function viteApiPlugin() {
  loadEnvFile();

  return {
    name: 'vite-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Only handle /api routes
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        try {
          // Parse the route
          const urlPath = req.url.split('?')[0];
          const routePath = urlPath.replace('/api/', '');

          // Dynamic import the handler using absolute path
          const handlerPath = resolve(PROJECT_ROOT, 'api', `${routePath}.js`);

          let handler;
          try {
            if (!existsSync(handlerPath)) {
              throw new Error(`File not found: ${handlerPath}`);
            }
            const module = await import(`file://${handlerPath}`);
            handler = module.default;
          } catch (err) {
            console.error(`API route not found: ${handlerPath}`, err.message);
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'API route not found' }));
            return;
          }

          // Create a Request object from the Node.js request
          const protocol = req.headers['x-forwarded-proto'] || 'http';
          const host = req.headers.host || 'localhost:5175';
          const fullUrl = `${protocol}://${host}${req.url}`;

          // Read body for POST requests
          let body = null;
          if (req.method === 'POST' || req.method === 'PUT') {
            body = await new Promise((resolve) => {
              let data = '';
              req.on('data', (chunk) => (data += chunk));
              req.on('end', () => resolve(data));
            });
          }

          const request = new Request(fullUrl, {
            method: req.method,
            headers: req.headers,
            body: body,
          });

          // Call the handler
          const response = await handler(request);

          // Write the response
          res.statusCode = response.status;

          // Copy headers
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'set-cookie') {
              // Handle multiple Set-Cookie headers
              const existing = res.getHeader('Set-Cookie') || [];
              const cookies = Array.isArray(existing) ? existing : [existing];
              cookies.push(value);
              res.setHeader('Set-Cookie', cookies);
            } else {
              res.setHeader(key, value);
            }
          });

          // Write body if not a redirect
          if (response.status !== 302 && response.status !== 301) {
            const text = await response.text();
            res.end(text);
          } else {
            res.end();
          }
        } catch (err) {
          console.error('API error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

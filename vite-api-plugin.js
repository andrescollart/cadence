/**
 * Vite plugin to handle API routes in development
 * Simulates Vercel serverless functions locally (Node.js runtime)
 */
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { parse as parseUrl } from 'url';

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

/**
 * Parse query string into object
 */
function parseQuery(url) {
  const parsed = parseUrl(url, true);
  return parsed.query || {};
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
            // Add cache busting for development
            const module = await import(`file://${handlerPath}?t=${Date.now()}`);
            handler = module.default;
          } catch (err) {
            console.error(`API route not found: ${handlerPath}`, err.message);
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'API route not found' }));
            return;
          }

          // Read body for POST/PUT requests
          let body = null;
          if (req.method === 'POST' || req.method === 'PUT') {
            const rawBody = await new Promise((resolve) => {
              let data = '';
              req.on('data', (chunk) => (data += chunk));
              req.on('end', () => resolve(data));
            });
            try {
              body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
              body = rawBody;
            }
          }

          // Augment req with Vercel-like properties
          req.query = parseQuery(req.url);
          req.body = body;

          // Create Vercel-like response helpers
          let statusCode = 200;
          const responseHeaders = {};

          const mockRes = {
            status(code) {
              statusCode = code;
              return this;
            },
            json(data) {
              res.statusCode = statusCode;
              res.setHeader('Content-Type', 'application/json');
              Object.entries(responseHeaders).forEach(([key, value]) => {
                res.setHeader(key, value);
              });
              res.end(JSON.stringify(data));
            },
            redirect(codeOrUrl, url) {
              if (typeof codeOrUrl === 'string') {
                res.statusCode = 302;
                res.setHeader('Location', codeOrUrl);
              } else {
                res.statusCode = codeOrUrl;
                res.setHeader('Location', url);
              }
              Object.entries(responseHeaders).forEach(([key, value]) => {
                res.setHeader(key, value);
              });
              res.end();
            },
            setHeader(name, value) {
              responseHeaders[name] = value;
              res.setHeader(name, value);
            },
            getHeader(name) {
              return responseHeaders[name];
            },
          };

          // Call the handler with Node.js-style (req, res)
          await handler(req, mockRes);
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

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), corsProxyPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

// Custom Plugin for Local CORS Proxy
const corsProxyPlugin = () => {
  return {
    name: 'configure-server',
    configureServer(server: any) {
      server.middlewares.use('/api/proxy', async (req: any, res: any, next: any) => {
        try {
          const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
          const targetUrl = urlObj.searchParams.get('url');

          if (!targetUrl) {
            res.statusCode = 400;
            res.end('Missing "url" query parameter');
            return;
          }

          // console.log(`Proxying to: ${targetUrl}`);

          // Forward the request
          const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
              ...req.headers,
              host: new URL(targetUrl).host, // Update host header
              origin: new URL(targetUrl).origin, // Spoof origin
              referer: new URL(targetUrl).origin, // Spoof referer
            },
            // @ts-ignore - Body handling for streams is complex in simple middleware, 
            // but for JSON payloads it's okay. For file uploads, we might need stream piping.
            // Let's try to read the body if it exists.
            body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : req
          });

          // Set CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

          // Handle preflight
          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.end();
            return;
          }

          res.statusCode = response.status;

          // Copy headers
          response.headers.forEach((value, key) => {
            // Avoid duplicate CORS headers
            if (!key.toLowerCase().startsWith('access-control-')) {
              res.setHeader(key, value);
            }
          });

          // Pipe response
          if (response.body) {
            // @ts-ignore
            const reader = response.body.getReader();
            const stream = new ReadableStream({
              start(controller) {
                return pump();
                function pump(): any {
                  return reader.read().then(({ done, value }) => {
                    if (done) {
                      controller.close();
                      return;
                    }
                    controller.enqueue(value);
                    res.write(value);
                    return pump();
                  });
                }
              }
            });
            await stream.cancel(); // Wait for stream to finish (pump handles writing)
            res.end();
          } else {
            res.end();
          }

        } catch (e: any) {
          console.error('Proxy Error:', e);
          res.statusCode = 500;
          res.end(`Proxy Error: ${e.message}`);
        }
      });
    }
  }
};

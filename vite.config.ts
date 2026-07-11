import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Local dev server API middleware to handle /api/generate and /api/analyze without needing a separate backend process
const localApiPlugin = () => ({
  name: 'local-api-middleware',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const isGenerate = req.url && req.url.startsWith('/api/generate');
      const isAnalyze = req.url && req.url.startsWith('/api/analyze');
      
      if (isGenerate || isAnalyze) {
        try {
          if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
          }

          // Buffer request body stream
          let body = '';
          await new Promise<void>((resolve, reject) => {
            req.on('data', (chunk: any) => { body += chunk; });
            req.on('end', () => resolve());
            req.on('error', (err: any) => reject(err));
          });

          const parsedBody = body ? JSON.parse(body) : {};
          
          if (isGenerate) {
            // Lazily import the generation logic module to avoid boot-time bundling issues in config
            const { handleGenerationLogic } = await import('./api/generate.ts');
            const result = await handleGenerationLogic(parsedBody);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } else {
            // Lazily import the analyze logic module
            const { handleAnalyzeLogic } = await import('./api/analyze.ts');
            const result = await handleAnalyzeLogic(parsedBody);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          }
        } catch (err: any) {
          console.error('Local API Middleware Error:', err);
          res.writeHead(err.status || 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message || '서버 오류가 발생했습니다.' }));
        }
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), localApiPlugin()],
  server: {
    port: 3002, // Localhost test port as requested by user
  },
})

import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: Number(process.env.PORT) || 5173 },
  build: { chunkSizeWarningLimit: 2000 },
});

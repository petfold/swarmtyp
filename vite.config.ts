import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from `/bzz/<ref>/` (path-based gateway) or `bzz://<ref>/` (Freedom): every URL must be relative.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'esnext', sourcemap: false, assetsInlineLimit: 4096, chunkSizeWarningLimit: 2000 },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@myriaddreamin/typst-ts-web-compiler', '@myriaddreamin/typst-ts-renderer'] },
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

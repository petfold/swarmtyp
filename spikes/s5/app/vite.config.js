import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  resolve: {
    dedupe: ['yjs'],
    alias: { '@solarpunkltd/swarm-collaborative-docs': resolve(import.meta.dirname, '../lib/dist/SwarmCollaborativeDocs.js') },
  },
  server: { host: '127.0.0.1', fs: { allow: [resolve(import.meta.dirname, '..')] } },
  optimizeDeps: { include: ['yjs'] },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const resolve = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  publicDir: false,
  resolve: {
    alias: {
      '@shared': resolve('./src/shared'),
      '@client': resolve('./src/client'),
    },
  },
  build: {
    outDir: resolve('./dist/client'),
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    // In dev the API is a separate process; in Docker one process serves both.
    proxy: { '/api': 'http://localhost:3000' },
  },
});

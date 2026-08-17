import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const resolve = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('./src/shared'),
      '@server': resolve('./src/server'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});

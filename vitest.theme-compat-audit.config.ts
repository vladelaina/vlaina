import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['scripts/theme-compat-audit.test.ts'],
    reporters: ['default'],
    testTimeout: 15000,
  },
});

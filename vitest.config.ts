import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'scheduler',
      '@codemirror/autocomplete',
      '@codemirror/commands',
      '@codemirror/language',
      '@codemirror/language-data',
      '@codemirror/lint',
      '@codemirror/search',
      '@codemirror/state',
      '@codemirror/theme-one-dark',
      '@codemirror/view',
    ],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@milkdown/core': path.resolve(__dirname, './vendor/milkdown/packages/core/src/index.ts'),
      '@milkdown/ctx': path.resolve(__dirname, './vendor/milkdown/packages/ctx/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    reporters: ['default'],
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 15000,
    server: {
      deps: {
        inline: [/^@codemirror\//, /^@lezer\//],
      },
    },
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      'test/e2e/**/*',
    ],
  },
});

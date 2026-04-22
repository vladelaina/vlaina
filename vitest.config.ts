import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@milkdown/core': path.resolve(__dirname, './vendor/milkdown/packages/core/src/index.ts'),
      '@milkdown/ctx': path.resolve(__dirname, './vendor/milkdown/packages/ctx/src/index.ts'),
      '@codemirror/language': path.resolve(__dirname, './vendor/milkdown/packages/crepe/node_modules/@codemirror/language'),
      '@codemirror/language-data': path.resolve(__dirname, './vendor/milkdown/packages/crepe/node_modules/@codemirror/language-data'),
      '@codemirror/state': path.resolve(__dirname, './vendor/milkdown/packages/crepe/node_modules/@codemirror/state'),
      '@codemirror/theme-one-dark': path.resolve(__dirname, './vendor/milkdown/packages/crepe/node_modules/@codemirror/theme-one-dark'),
      '@codemirror/view': path.resolve(__dirname, './vendor/milkdown/packages/crepe/node_modules/@codemirror/view'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    reporters: ['default'],
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
  },
});

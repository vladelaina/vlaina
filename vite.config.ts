import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "path";
import fs from "fs";

const host = process.env.TAURI_DEV_HOST;

/**
 * Plugin to copy index.html to 404.html for SPA support
 */
function spaFallbackPlugin(): Plugin {
  return {
    name: 'spa-fallback',
    closeBundle() {
      const distPath = path.resolve(__dirname, 'dist');
      const indexPath = path.join(distPath, 'index.html');
      const notFoundPath = path.join(distPath, '404.html');

      if (fs.existsSync(indexPath)) {
        fs.copyFileSync(indexPath, notFoundPath);
        console.log('Created 404.html for SPA support');
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    spaFallbackPlugin(),
    viteStaticCopy({
      targets: [
        // Copy fontsource font files
        {
          src: 'node_modules/@fontsource/*/files/*',
          dest: 'assets/files'
        }
      ]
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Base path - always '/' for custom domain (app.nekotick.com)
  base: '/',

  // Build options
  build: {
    // Output directory
    outDir: 'dist',
    // Generate sourcemaps for debugging
    sourcemap: false,
    // Optimize chunk size
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
            if (id.includes('/@milkdown/')) return 'editor-vendor';
            if (id.includes('/@tauri-apps/')) return 'tauri-vendor';
            if (id.includes('/@radix-ui/')) return 'radix-vendor';
            if (id.includes('/framer-motion/')) return 'motion-vendor';
            if (
              id.includes('/react-markdown/') ||
              id.includes('/remark-gfm/') ||
              id.includes('/rehype-raw/') ||
              id.includes('/rehype-sanitize/')
            ) {
              return 'markdown-vendor';
            }
            if (
              id.includes('/remark-math/') ||
              id.includes('/rehype-katex/') ||
              id.includes('/katex/')
            ) {
              return 'math-vendor';
            }
            if (id.includes('/shiki/') || id.includes('/highlight.js/')) return 'code-vendor';
          }

          if (id.includes('/src/components/Notes/features/Editor/')) return 'notes-editor';
          if (id.includes('/src/components/Notes/features/Cover/')) return 'notes-cover';
          if (id.includes('/src/components/Notes/features/Sidebar/')) return 'notes-sidebar';
          if (id.includes('/src/components/Notes/features/Tabs/')) return 'notes-tabs';

          return undefined;
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 3000,
    strictPort: true,
    host: "127.0.0.1",
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));

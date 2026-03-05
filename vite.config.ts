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
    // Mermaid ecosystem pulls in a large but lazily-loaded chunk; raise warning threshold to reduce noise.
    chunkSizeWarningLimit: 1700,
    // Optimize chunk size
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'react-vendor';
          }

          if (id.includes('/@milkdown/') || id.includes('/prosemirror/') || id.includes('/@codemirror/')) {
            return 'notes-editor-vendor';
          }

          if (id.includes('/katex/')) {
            return 'katex-vendor';
          }

          if (
            id.includes('/remark-') ||
            id.includes('/rehype-') ||
            id.includes('/unified/') ||
            id.includes('/micromark/') ||
            id.includes('/mdast-') ||
            id.includes('/hast-')
          ) {
            return 'notes-markdown-vendor';
          }

          if (id.includes('/mermaid/')) {
            return 'mermaid-core-vendor';
          }

          if (id.includes('/d3-') || id.includes('/d3/')) {
            return 'd3-vendor';
          }

          if (id.includes('/cose-bilkent')) {
            return 'cytoscape-layout-vendor';
          }

          if (id.includes('/cytoscape')) {
            return 'cytoscape-vendor';
          }

          if (id.includes('/dagre') || id.includes('/graphlib')) {
            return 'dagre-vendor';
          }

          if (id.includes('/@tauri-apps/')) {
            return 'tauri-vendor';
          }

          if (id.includes('/framer-motion/') || id.includes('/@radix-ui/')) {
            return 'ui-vendor';
          }
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

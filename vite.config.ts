import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

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
      const redirectsPath = path.join(distPath, '_redirects');

      if (fs.existsSync(indexPath)) {
        fs.copyFileSync(indexPath, notFoundPath);
        console.log('Created 404.html for SPA support');
      }

      if (fs.existsSync(redirectsPath)) {
        fs.unlinkSync(redirectsPath);
        console.log('Removed legacy _redirects for Workers Assets');
      }
    },
  };
}

function woff2OnlyFontCssPlugin(): Plugin {
  const fallbackFontSrcPattern =
    /src:\s*url\(([^)]*?\.woff2[^)]*)\)\s*format\((['"])woff2\2\)(?:\s*,\s*url\([^)]*?\)\s*format\((['"])(?:woff|truetype)\3\))+(?=[;}])/g;

  return {
    name: 'woff2-only-font-css',
    enforce: 'pre',
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, '/');
      if (!normalizedId.includes('@fontsource') && !normalizedId.includes('/katex/dist/katex')) {
        return null;
      }

      const nextCode = code.replace(
        fallbackFontSrcPattern,
        (_match, woff2Url: string) => `src: url(${woff2Url}) format("woff2")`,
      );

      return nextCode === code ? null : { code: nextCode, map: null };
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    woff2OnlyFontCssPlugin(),
    react(),
    spaFallbackPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@milkdown/core": path.resolve(__dirname, "./vendor/milkdown/packages/core/src/index.ts"),
      "@milkdown/ctx": path.resolve(__dirname, "./vendor/milkdown/packages/ctx/src/index.ts"),
      "@codemirror/language": path.resolve(__dirname, "./vendor/milkdown/packages/crepe/node_modules/@codemirror/language"),
      "@codemirror/language-data": path.resolve(__dirname, "./vendor/milkdown/packages/crepe/node_modules/@codemirror/language-data"),
      "@codemirror/state": path.resolve(__dirname, "./vendor/milkdown/packages/crepe/node_modules/@codemirror/state"),
      "@codemirror/theme-one-dark": path.resolve(__dirname, "./vendor/milkdown/packages/crepe/node_modules/@codemirror/theme-one-dark"),
      "@codemirror/view": path.resolve(__dirname, "./vendor/milkdown/packages/crepe/node_modules/@codemirror/view"),
    },
  },
  // Base path - always '/' for custom domain (app.vlaina.com)
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
          if (id.includes('/vendor/milkdown/packages/')) {
            return 'notes-milkdown-vendor';
          }

          if (!id.includes('node_modules')) return;

          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'react-vendor';
          }

          if (
            id.includes('/@codemirror/lang-') ||
            id.includes('/@codemirror/legacy-modes/') ||
            id.includes('/@lezer/')
          ) {
            return;
          }

          if (id.includes('/@codemirror/')) {
            return 'notes-codemirror-core-vendor';
          }

          if (id.includes('/prosemirror/')) {
            return 'notes-prosemirror-vendor';
          }

          if (id.includes('/@milkdown/')) {
            return 'notes-milkdown-vendor';
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

          if (id.includes('/dagre-d3-es/') || id.includes('/dagre/') || id.includes('/graphlib/')) {
            return 'mermaid-layout-vendor';
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

          if (id.includes('/framer-motion/') || id.includes('/@radix-ui/')) {
            return 'ui-vendor';
          }
        },
      },
    },
  },

  // Vite options for Electron renderer development.
  clearScreen: false,
  server: {
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 3000,
    strictPort: true,
    host: "127.0.0.1",
    headers: {
      "Cache-Control": "no-store",
    },
  },
}));

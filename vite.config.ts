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
    apply: 'build',
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

function isReactSingletonModule(id: string): boolean {
  return /(?:^|\/)node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:react|react-dom|scheduler)(?:\/|$)/.test(id);
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    woff2OnlyFontCssPlugin(),
    react(),
    spaFallbackPlugin(),
  ],
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
      "@": path.resolve(__dirname, "./src"),
      "@milkdown/core": path.resolve(__dirname, "./vendor/milkdown/packages/core/src/index.ts"),
      "@milkdown/ctx": path.resolve(__dirname, "./vendor/milkdown/packages/ctx/src/index.ts"),
    },
  },
  // Use relative asset URLs so packaged Electron builds can load dist/index.html via file://.
  base: './',

  // Build options
  build: {
    // Keep heavy lazy routes lazy in packaged Electron startup too.
    // Vite's default modulepreload hints can pull Notes/Markdown/editor chunks
    // into memory before the user opens those surfaces.
    modulePreload: false,
    // Output directory
    outDir: 'dist',
    // Generate sourcemaps for debugging
    sourcemap: false,
    // ZenUML support is an intentionally lazy Mermaid extension, but its upstream
    // bundle is a single large module. Keep the warning threshold above that
    // known lazy chunk while preserving warnings for new larger bundles.
    chunkSizeWarningLimit: 3600,
    // Optimize chunk size
    rollupOptions: {
      checks: {
        pluginTimings: false,
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (isReactSingletonModule(normalizedId)) {
            return 'react-vendor';
          }

          if (!normalizedId.includes('node_modules')) return;

          if (normalizedId.includes('/dagre-d3-es/') || normalizedId.includes('/dagre/') || normalizedId.includes('/graphlib/')) {
            return 'mermaid-layout-vendor';
          }

          if (normalizedId.includes('/d3-') || normalizedId.includes('/d3/')) {
            return 'd3-vendor';
          }

          if (normalizedId.includes('/cose-bilkent')) {
            return 'cytoscape-layout-vendor';
          }

          if (normalizedId.includes('/cytoscape')) {
            return 'cytoscape-vendor';
          }

          if (normalizedId.includes('/@radix-ui/')) {
            return 'ui-vendor';
          }
        },
      },
    },
  },
  worker: {
    rollupOptions: {
      checks: {
        pluginTimings: false,
      },
    },
  },

  // Vite options for Electron renderer development.
  clearScreen: false,
  server: {
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 3000,
    strictPort: true,
    host: "127.0.0.1",
    watch: {
      ignored: [
        '**/.git/**',
        '**/dist/**',
        '**/release/**',
        '**/temp/**',
        '**/temp/electron-user-data/**',
      ],
    },
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/AppContent.tsx',
        './src/components/Notes/NotesView.tsx',
        './src/components/Notes/features/Editor/index.ts',
        './src/components/Notes/features/Tabs/NotesTabRow.tsx',
        './src/components/Notes/features/Sidebar/NotesSidebarWrapper.tsx',
      ],
    },
    headers: {
      "Cache-Control": "no-store",
    },
  },
}));

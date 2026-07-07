import path from 'node:path';

const RENDERER_WARMUP_TIMEOUT_MS = 60_000;
const RENDERER_WARMUP_MAX_MODULES = 2500;
const RENDERER_WARMUP_RECURSIVE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.css']);
const RENDERER_WARMUP_PATHS = [
  '/',
  '/src/components/Notes/features/Editor/index.ts',
  '/src/components/Notes/features/Editor/MarkdownEditor.tsx',
  '/src/components/Notes/features/Editor/MilkdownEditorInner.tsx',
  '/src/components/Notes/features/Tabs/NotesTabRow.tsx',
  '/src/components/Notes/features/Sidebar/NotesSidebarWrapper.tsx',
  '/src/components/Notes/NotesView.tsx',
  '/src/components/Chat/ChatView.tsx',
  '/src/components/Chat/features/Sidebar/ChatSidebar.tsx',
  '/src/components/Chat/features/Input/ModelSelector.tsx',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/AppContent.tsx',
];

function shouldRecursivelyWarmPath(pathname) {
  if (pathname === '/') return false;
  if (pathname.startsWith('/@vite/')) return false;
  if (pathname.startsWith('/node_modules/.vite/')) return false;

  const extension = path.extname(pathname);
  return RENDERER_WARMUP_RECURSIVE_EXTENSIONS.has(extension);
}

function extractModuleSpecifiers(code) {
  const specifiers = new Set();
  const patterns = [
    /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      specifiers.add(match[1]);
    }
  }

  return [...specifiers];
}

function resolveWarmupSpecifier(baseUrl, specifier) {
  if (
    specifier.startsWith('node:') ||
    specifier.startsWith('data:') ||
    specifier.startsWith('blob:') ||
    specifier.startsWith('virtual:')
  ) {
    return null;
  }

  try {
    if (specifier.startsWith('/') || specifier.startsWith('.')) {
      return new URL(specifier, baseUrl);
    }

    return null;
  } catch {
    return null;
  }
}

async function warmRendererPath(devUrl, pathname, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RENDERER_WARMUP_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const url = pathname instanceof URL ? pathname : new URL(pathname, devUrl);
    const response = await (options.fetchImpl ?? fetch)(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: url.pathname === '/' ? 'text/html,*/*' : 'text/javascript,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = options.text ? await response.text() : await response.arrayBuffer();
    return {
      durationMs: Date.now() - startedAt,
      text: options.text ? body : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function warmRendererDependencyGraph(devUrl, rootPathname, seen, options) {
  const queue = [new URL(rootPathname, devUrl)];
  let warmedModules = 0;

  while (queue.length > 0) {
    if (options.isShutdownRequested()) {
      throw new Error('Dev startup interrupted');
    }

    if (seen.size >= RENDERER_WARMUP_MAX_MODULES) {
      break;
    }

    const url = queue.shift();
    if (!url) continue;

    const key = url.href;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!shouldRecursivelyWarmPath(url.pathname)) {
      continue;
    }

    let text;
    try {
      ({ text } = await warmRendererPath(devUrl, url, { ...options, text: true }));
      warmedModules += 1;
    } catch {
      continue;
    }

    if (!text) continue;

    for (const specifier of extractModuleSpecifiers(text)) {
      const resolved = resolveWarmupSpecifier(url, specifier);
      if (!resolved) continue;
      if (resolved.origin !== new URL(devUrl).origin) continue;
      if (seen.has(resolved.href)) continue;
      queue.push(resolved);
    }
  }

  return warmedModules;
}

export async function warmRendererModules(devUrl, options = {}) {
  const {
    isShutdownRequested = () => false,
    log = () => {},
  } = options;
  const warmOptions = { ...options, isShutdownRequested };

  log('90', 'Warming renderer startup modules');
  const startedAt = Date.now();
  const results = [];
  const seen = new Set();

  for (const pathname of RENDERER_WARMUP_PATHS) {
    if (isShutdownRequested()) {
      throw new Error('Dev startup interrupted');
    }

    const pathStartedAt = Date.now();
    try {
      const { durationMs } = await warmRendererPath(devUrl, pathname, warmOptions);
      const dependencyCount = await warmRendererDependencyGraph(devUrl, pathname, seen, warmOptions);
      const totalPathMs = Date.now() - pathStartedAt;
      results.push({ path: pathname, ok: true, durationMs, dependencyCount, totalMs: totalPathMs });
      log('90', `  warmed ${pathname} in ${totalPathMs}ms (${dependencyCount} deps)`);
    } catch (error) {
      const durationMs = Date.now() - pathStartedAt;
      results.push({
        path: pathname,
        ok: false,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });
      log(
        '33',
        `  warmup failed for ${pathname} after ${durationMs}ms: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const totalMs = Date.now() - startedAt;
  log('32', `Renderer warmup finished in ${totalMs}ms`);
  return { totalMs, results };
}

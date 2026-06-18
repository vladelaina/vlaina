import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertNotWsl } from './ensure-not-wsl.mjs';

assertNotWsl('dev');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DEFAULT_PORT = 3000;
const MAX_PORT = 3100;
const DEPENDENCY_UPDATE_CHECK_TIMEOUT_MS = 45_000;
const DEPENDENCY_UPDATE_CHECK_MAX_ITEMS = 12;
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
const ELECTRON_WATCH_PATHS = [
  path.join(repoRoot, 'electron'),
  path.join(repoRoot, 'scripts'),
  path.join(repoRoot, 'package.json'),
  path.join(repoRoot, 'vite.config.ts'),
  path.join(repoRoot, 'tsconfig.node.json'),
];

const isWindows = process.platform === 'win32';
const pnpmCommand = isWindows ? 'pnpm.cmd' : 'pnpm';

let rendererProcess = null;
let electronProcess = null;
let shutdownRequested = false;
let restartingElectron = false;
let restartTimer = null;
let electronRestartQueued = false;
const watchers = [];

function log(colorCode, message) {
  console.log(`\x1b[${colorCode}m[vlaina] ${message}\x1b[0m`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort) {
  if (!(await checkPortAvailable(startPort))) {
    log(
      '33',
      `Renderer port ${startPort} is already in use; reusing another port will split dev localStorage. Stop the old dev server if startup view looks stale.`
    );
  }

  for (let port = startPort; port < MAX_PORT; port += 1) {
    if (await checkPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available ports found between ${startPort} and ${MAX_PORT - 1}`);
}

function waitForPortOpen(port, timeoutMs) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      if (shutdownRequested) {
        reject(new Error('Dev startup interrupted'));
        return;
      }

      const socket = net.createConnection({ host: '127.0.0.1', port });

      socket.once('connect', () => {
        socket.end();
        resolve();
      });

      socket.once('error', () => {
        socket.destroy();

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for renderer on port ${port}`));
          return;
        }

        setTimeout(tryConnect, 250);
      });
    };

    tryConnect();
  });
}

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
    const response = await fetch(url, {
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

async function warmRendererDependencyGraph(devUrl, rootPathname, seen) {
  const queue = [new URL(rootPathname, devUrl)];
  let warmedModules = 0;

  while (queue.length > 0) {
    if (shutdownRequested) {
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
      ({ text } = await warmRendererPath(devUrl, url, { text: true }));
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

async function warmRendererModules(devUrl) {
  log('90', 'Warming renderer startup modules');
  const startedAt = Date.now();
  const results = [];
  const seen = new Set();

  for (const pathname of RENDERER_WARMUP_PATHS) {
    if (shutdownRequested) {
      throw new Error('Dev startup interrupted');
    }

    const pathStartedAt = Date.now();
    try {
      const { durationMs } = await warmRendererPath(devUrl, pathname);
      const dependencyCount = await warmRendererDependencyGraph(devUrl, pathname, seen);
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

function spawnPnpm(args, env, label) {
  const child = spawn(pnpmCommand, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
    shell: isWindows,
    detached: !isWindows,
  });

  child.once('error', (error) => {
    console.error(`[vlaina] Failed to start ${label}:`, error);
  });

  return child;
}

function parseDependencyUpdateCheckOutput(output) {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  try {
    return JSON.parse(output.slice(start, end + 1));
  } catch {
    return null;
  }
}

function formatDependencyUpdateLine(name, info) {
  const current = info && typeof info.current === 'string' ? info.current : 'unknown';
  const latest = info && typeof info.latest === 'string' ? info.latest : 'unknown';
  const wanted = info && typeof info.wanted === 'string' ? info.wanted : null;
  const type = info && typeof info.dependencyType === 'string' ? info.dependencyType : 'dependency';
  const wantedSuffix = wanted && wanted !== latest ? `, wanted ${wanted}` : '';
  return `${name}: ${current} -> ${latest}${wantedSuffix} (${type})`;
}

function checkDependencyUpdates(env) {
  if (process.env.VLAINA_SKIP_DEPENDENCY_UPDATE_CHECK === '1') {
    log('90', 'Skipped dependency update check');
    return;
  }

  log('90', 'Checking dependency updates in the background');

  const child = spawn(pnpmCommand, ['outdated', '--format', 'json'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    shell: isWindows,
  });

  let stdout = '';
  let stderr = '';
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    log('33', 'Dependency update check timed out');
    killChildProcess(child);
  }, DEPENDENCY_UPDATE_CHECK_TIMEOUT_MS);

  child.stdout?.on('data', (chunk) => {
    stdout += String(chunk);
  });

  child.stderr?.on('data', (chunk) => {
    stderr += String(chunk);
  });

  child.once('error', (error) => {
    clearTimeout(timeout);
    log('33', `Dependency update check failed to start: ${error.message}`);
  });

  child.once('exit', (code) => {
    clearTimeout(timeout);

    if (shutdownRequested || timedOut) {
      return;
    }

    const updates = parseDependencyUpdateCheckOutput(stdout);
    if (updates && typeof updates === 'object') {
      const entries = Object.entries(updates);
      if (entries.length === 0) {
        log('32', 'Dependencies are up to date');
        return;
      }

      log('33', `Dependency updates available (${entries.length})`);
      for (const [name, info] of entries.slice(0, DEPENDENCY_UPDATE_CHECK_MAX_ITEMS)) {
        log('33', `  ${formatDependencyUpdateLine(name, info)}`);
      }
      if (entries.length > DEPENDENCY_UPDATE_CHECK_MAX_ITEMS) {
        log('33', `  ...and ${entries.length - DEPENDENCY_UPDATE_CHECK_MAX_ITEMS} more`);
      }
      log('90', 'Run `pnpm outdated` for the full dependency report');
      return;
    }

    const message = (stderr || stdout).trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (code === 0) {
      log('32', 'Dependencies are up to date');
      return;
    }

    log('33', `Dependency update check could not complete${message ? `: ${message}` : ''}`);
  });
}

function killChildProcess(child) {
  if (!child || child.killed || child.exitCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    child.once('exit', () => resolve());

    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        shell: false,
      });
      killer.once('exit', () => resolve());
      killer.once('error', () => {
        try {
          child.kill();
        } catch {}
        resolve();
      });
      return;
    }

    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {
        resolve();
        return;
      }
    }

    setTimeout(() => {
      if (child.exitCode === null) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {}
      }
    }, 1500);
  });
}

async function startElectron(env) {
  if (shutdownRequested) {
    return;
  }

  log('36', 'Starting Electron');
  const electronEnv = normalizeElectronDesktopEnv(env);
  updateLinuxDesktopActivationEnvironment(electronEnv);
  electronProcess = spawnPnpm(['exec', 'electron', '.'], electronEnv, 'Electron');

  electronProcess.once('exit', async (code, signal) => {
    const exitedProcess = electronProcess;
    electronProcess = null;

    if (shutdownRequested || restartingElectron) {
      return;
    }

    if (code === 0 || signal === 'SIGTERM') {
      await shutdown(0);
      return;
    }

    console.error(`[vlaina] Electron exited unexpectedly with code ${code ?? 'null'} signal ${signal ?? 'null'}`);
    await shutdown(code ?? 1);
  });
}

async function restartElectron(env, reason) {
  if (shutdownRequested) {
    return;
  }

  if (restartingElectron) {
    electronRestartQueued = true;
    return;
  }

  restartingElectron = true;
  log('33', `Restarting Electron (${reason})`);

  const previous = electronProcess;
  electronProcess = null;
  await killChildProcess(previous);
  await delay(150);
  await startElectron(env);

  restartingElectron = false;

  if (electronRestartQueued) {
    electronRestartQueued = false;
    await restartElectron(env, 'queued change');
  }
}

function watchElectronSources(env) {
  const scheduleRestart = (reason) => {
    if (shutdownRequested) {
      return;
    }

    log('33', `Detected desktop-host change: ${reason}`);

    if (restartTimer) {
      clearTimeout(restartTimer);
    }

    restartTimer = setTimeout(() => {
      restartTimer = null;
      void restartElectron(env, reason);
    }, 180);
  };

  for (const watchPath of ELECTRON_WATCH_PATHS) {
    if (!fs.existsSync(watchPath)) {
      continue;
    }

    log('90', `Watching ${path.relative(repoRoot, watchPath) || path.basename(watchPath)}`);

    const watcher = fs.watch(
      watchPath,
      { recursive: fs.statSync(watchPath).isDirectory() },
      (_eventType, filename) => {
        if (!filename) {
          scheduleRestart(path.basename(watchPath));
          return;
        }

        if (String(filename).includes('node_modules')) {
          return;
        }

        scheduleRestart(`${path.basename(watchPath)}:${filename}`);
      }
    );

    watcher.on('error', (error) => {
      console.error(`[vlaina] Watch error for ${watchPath}:`, error);
    });

    watchers.push(watcher);
  }
}

async function shutdown(exitCode = 0) {
  if (shutdownRequested) {
    process.exit(exitCode);
    return;
  }

  shutdownRequested = true;

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  while (watchers.length > 0) {
    try {
      watchers.pop()?.close();
    } catch {}
  }

  await killChildProcess(electronProcess);
  electronProcess = null;

  await killChildProcess(rendererProcess);
  rendererProcess = null;

  process.exit(exitCode);
}

function normalizeElectronDesktopEnv(env) {
  if (process.platform !== 'linux') {
    return env;
  }

  const next = { ...env };
  const hasWaylandDisplay = typeof next.WAYLAND_DISPLAY === 'string' && next.WAYLAND_DISPLAY.trim().length > 0;
  const hasX11Display = typeof next.DISPLAY === 'string' && next.DISPLAY.trim().length > 0;
  const sessionType = typeof next.XDG_SESSION_TYPE === 'string' ? next.XDG_SESSION_TYPE.trim().toLowerCase() : '';

  if (hasWaylandDisplay && (!sessionType || sessionType === 'tty')) {
    next.XDG_SESSION_TYPE = 'wayland';
    log('33', 'Adjusted Electron XDG_SESSION_TYPE=wayland for desktop dialogs');
  } else if (hasX11Display && (!sessionType || sessionType === 'tty')) {
    next.XDG_SESSION_TYPE = 'x11';
    log('33', 'Adjusted Electron XDG_SESSION_TYPE=x11 for desktop dialogs');
  }

  if (!next.GTK_USE_PORTAL) {
    next.GTK_USE_PORTAL = '0';
    log('33', 'Adjusted Electron GTK_USE_PORTAL=0 for desktop dialogs');
  }

  if (!next.XDG_CURRENT_DESKTOP) {
    if (typeof next.DESKTOP_SESSION === 'string' && next.DESKTOP_SESSION.trim()) {
      next.XDG_CURRENT_DESKTOP = next.DESKTOP_SESSION.trim();
      log('33', `Adjusted Electron XDG_CURRENT_DESKTOP=${next.XDG_CURRENT_DESKTOP} from DESKTOP_SESSION`);
    } else if (
      fs.existsSync('/usr/share/xdg-desktop-portal/gtk-portals.conf')
      && fs.existsSync('/usr/share/xdg-desktop-portal/niri-portals.conf')
    ) {
      next.XDG_CURRENT_DESKTOP = 'gtk';
      log('33', 'Adjusted Electron XDG_CURRENT_DESKTOP=gtk to avoid broken niri GNOME portal fallback');
    } else if (fs.existsSync('/usr/share/xdg-desktop-portal/niri-portals.conf')) {
      next.XDG_CURRENT_DESKTOP = 'niri';
      log('33', 'Adjusted Electron XDG_CURRENT_DESKTOP=niri for xdg-desktop-portal');
    } else {
      log('33', 'XDG_CURRENT_DESKTOP is not set; Linux file dialogs may require xdg-desktop-portal configuration');
    }
  }

  return next;
}

let desktopActivationEnvironmentUpdated = false;

function updateLinuxDesktopActivationEnvironment(env) {
  if (desktopActivationEnvironmentUpdated || process.platform !== 'linux') {
    return;
  }

  desktopActivationEnvironmentUpdated = true;

  const variables = [
    'WAYLAND_DISPLAY',
    'DISPLAY',
    'XDG_CURRENT_DESKTOP',
    'XDG_SESSION_TYPE',
    'DESKTOP_SESSION',
    'DBUS_SESSION_BUS_ADDRESS',
  ]
    .filter((name) => typeof env[name] === 'string' && env[name].trim().length > 0)
    .map((name) => `${name}=${env[name]}`);

  if (variables.length === 0) {
    return;
  }

  const result = spawnSync('dbus-update-activation-environment', ['--systemd', ...variables], {
    env,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (result.status === 0) {
    log('33', 'Updated D-Bus/systemd desktop activation environment for Linux dialogs');
    return;
  }

  const message = (result.stderr || result.stdout || '').trim();
  log('33', `Failed to update D-Bus/systemd desktop activation environment${message ? `: ${message}` : ''}`);
}

async function startDev() {
  const port = await findAvailablePort(DEFAULT_PORT);
  const devUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    VITE_PORT: String(port),
    VITE_DEV_SERVER_URL: devUrl,
  };

  log('32', `Using renderer port ${port}`);
  log('36', `Renderer URL ${devUrl}`);
  log(
    '36',
    env.VLAINA_USER_DATA_DIR
      ? `Electron userData override ${env.VLAINA_USER_DATA_DIR}`
      : 'Electron userData default app path'
  );

  const rendererScript = process.env.VLAINA_FORCE_VITE_OPTIMIZE === '1'
    ? 'dev:renderer:force'
    : 'dev:renderer';
  if (rendererScript === 'dev:renderer:force') {
    log('33', 'Forcing Vite dependency optimization');
  }

  rendererProcess = spawnPnpm(['run', rendererScript], env, 'renderer');
  rendererProcess.once('exit', async (code, signal) => {
    rendererProcess = null;

    if (shutdownRequested) {
      return;
    }

    console.error(`[vlaina] Renderer exited with code ${code ?? 'null'} signal ${signal ?? 'null'}`);
    await shutdown(code ?? 1);
  });

  await waitForPortOpen(port, 30_000);
  log('32', 'Renderer is ready');
  await warmRendererModules(devUrl);

  watchElectronSources(env);
  await startElectron(env);
  checkDependencyUpdates(env);
}

process.on('SIGINT', () => {
  void shutdown(0);
});

process.on('SIGTERM', () => {
  void shutdown(0);
});

process.on('uncaughtException', async (error) => {
  console.error('[vlaina] Uncaught exception in dev runner:', error);
  await shutdown(1);
});

process.on('unhandledRejection', async (error) => {
  console.error('[vlaina] Unhandled rejection in dev runner:', error);
  await shutdown(1);
});

startDev().catch(async (error) => {
  console.error(`[vlaina] ${error instanceof Error ? error.message : String(error)}`);
  await shutdown(1);
});

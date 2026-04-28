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

function spawnPnpm(args, env, label) {
  const child = spawn(pnpmCommand, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
    shell: isWindows,
  });

  child.once('error', (error) => {
    console.error(`[vlaina] Failed to start ${label}:`, error);
  });

  return child;
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
      child.kill('SIGTERM');
    } catch {
      resolve();
      return;
    }

    setTimeout(() => {
      if (child.exitCode === null) {
        try {
          child.kill('SIGKILL');
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

  if (!next.XDG_CURRENT_DESKTOP) {
    if (typeof next.DESKTOP_SESSION === 'string' && next.DESKTOP_SESSION.trim()) {
      next.XDG_CURRENT_DESKTOP = next.DESKTOP_SESSION.trim();
      log('33', `Adjusted Electron XDG_CURRENT_DESKTOP=${next.XDG_CURRENT_DESKTOP} from DESKTOP_SESSION`);
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

  rendererProcess = spawnPnpm(['run', 'dev:renderer'], env, 'renderer');
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

  watchElectronSources(env);
  await startElectron(env);
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

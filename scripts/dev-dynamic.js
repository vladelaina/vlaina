import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertNotWsl } from './ensure-not-wsl.mjs';
import {
  DEFAULT_PORT,
  chooseAvailablePort,
  delay,
  waitForPortOpen,
} from './dev-dynamic-ports.mjs';
import { warmRendererModules } from './dev-dynamic-renderer-warmup.mjs';
import {
  configureDevelopmentProfileEnv as configureDevelopmentProfileEnvForRoot,
  ensureIsolatedDevelopmentUserDataPath,
  getDevelopmentUserDataPath as getDevelopmentUserDataPathForRoot,
} from './dev-dynamic-profile.mjs';
import {
  killChildProcess,
  signalSpawnedChildren,
  spawnManagedCommand,
} from './dev-dynamic-processes.mjs';
import { checkDependencyUpdates } from './dev-dynamic-dependencies.mjs';
import {
  normalizeElectronDesktopEnv,
  updateLinuxDesktopActivationEnvironment,
} from './dev-dynamic-electron-env.mjs';
import { buildPreloadBundle } from './build-preload-bundle.mjs';

assertNotWsl('dev');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

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
let shutdownPromise = null;
let restartingElectron = false;
let restartTimer = null;
let electronRestartQueued = false;
const watchers = [];
const spawnedChildren = new Set();
const desktopActivationEnvironmentState = { updated: false };
function log(colorCode, message) {
  console.log(`\x1b[${colorCode}m[vlaina] ${message}\x1b[0m`);
}
async function findAvailablePort(startPort) {
  return chooseAvailablePort(startPort, {
    isPortUsable: isDevelopmentPortUsable,
    isShutdownRequested: () => shutdownRequested,
    log,
  });
}
function spawnPnpm(args, env, label) {
  return spawnManagedCommand(pnpmCommand, args, {
    cwd: repoRoot,
    env,
    isWindows,
    label,
    spawnedChildren,
  });
}
export function getDevelopmentUserDataPath(port) {
  return getDevelopmentUserDataPathForRoot(repoRoot, port);
}

function readActiveElectronLockPid(userDataPath) {
  let lockTarget = '';
  try {
    lockTarget = fs.readlinkSync(path.join(userDataPath, 'SingletonLock'));
  } catch {
    return null;
  }

  const pid = Number(lockTarget.match(/-(\d+)$/)?.[1]);
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return null;
  }

  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

function isDevelopmentPortUsable(port) {
  const userDataPath = getDevelopmentUserDataPath(port);
  const lockPid = readActiveElectronLockPid(userDataPath);
  if (lockPid === null) {
    return true;
  }

  log('33', `Skipping renderer port ${port}; Electron userData is locked by PID ${lockPid}.`);
  return false;
}

export { chooseAvailablePort, ensureIsolatedDevelopmentUserDataPath };
export function configureDevelopmentProfileEnv(env, port, options = {}) {
  return configureDevelopmentProfileEnvForRoot(env, port, {
    ...options,
    log: options.log ?? log,
    repoRoot,
  });
}

async function startElectron(env) {
  if (shutdownRequested) {
    return;
  }

  await buildPreloadBundle();
  log('36', 'Starting Electron');
  const electronEnv = normalizeElectronDesktopEnv(env, { log });
  updateLinuxDesktopActivationEnvironment(electronEnv, desktopActivationEnvironmentState, { log });
  electronProcess = spawnPnpm(['exec', 'electron', '.'], electronEnv, 'Electron');

  electronProcess.once('exit', async (code, signal) => {
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
        if (path.basename(String(filename)) === 'preload.bundle.cjs') {
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
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownRequested = true;

  shutdownPromise = (async () => {
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
  })();

  return shutdownPromise;
}

async function startDev() {
  const port = await findAvailablePort(DEFAULT_PORT);
  const devUrl = `http://127.0.0.1:${port}`;
  const env = configureDevelopmentProfileEnv({
    ...process.env,
    VITE_PORT: String(port),
    VITE_DEV_SERVER_URL: devUrl,
  }, port);
  if (!env.VLAINA_USER_DATA_DIR?.trim()) {
    throw new Error('Dev startup requires isolated Electron userData');
  }

  log('32', `Using renderer port ${port}`);
  log('36', `Renderer URL ${devUrl}`);
  log('36', `Electron userData ${env.VLAINA_USER_DATA_DIR}`);

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

  await waitForPortOpen(port, 30_000, { isShutdownRequested: () => shutdownRequested });
  log('32', 'Renderer is ready');
  await warmRendererModules(devUrl, { isShutdownRequested: () => shutdownRequested, log });

  watchElectronSources(env);
  await startElectron(env);
  checkDependencyUpdates(env, {
    cwd: repoRoot,
    isShutdownRequested: () => shutdownRequested,
    isWindows,
    killChildProcess,
    log,
    pnpmCommand,
  });
}

function isDirectRun() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isDirectRun()) {
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT']) {
    process.on(signal, () => {
      void shutdown(0);
    });
  }

  process.once('exit', () => {
    signalSpawnedChildren(spawnedChildren, 'SIGTERM');
  });

  const shutdownOnError = async (label, error) => {
    console.error(`[vlaina] ${label}:`, error);
    await shutdown(1);
  };
  process.on('uncaughtException', (error) => shutdownOnError('Uncaught exception in dev runner', error));
  process.on('unhandledRejection', (error) => shutdownOnError('Unhandled rejection in dev runner', error));

  startDev().catch(async (error) => {
    console.error(`[vlaina] ${error instanceof Error ? error.message : String(error)}`);
    await shutdown(1);
  });
}

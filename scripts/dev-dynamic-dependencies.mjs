import { spawn } from 'node:child_process';

const DEPENDENCY_UPDATE_CHECK_TIMEOUT_MS = 45_000;
const DEPENDENCY_UPDATE_CHECK_MAX_ITEMS = 12;

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

export function checkDependencyUpdates(env, options = {}) {
  const {
    cwd,
    isShutdownRequested = () => false,
    isWindows = process.platform === 'win32',
    killChildProcess,
    log = () => {},
    pnpmCommand,
  } = options;

  if (process.env.VLAINA_SKIP_DEPENDENCY_UPDATE_CHECK === '1') {
    log('90', 'Skipped dependency update check');
    return;
  }

  log('90', 'Checking dependency updates in the background');

  const child = spawn(pnpmCommand, ['outdated', '--format', 'json'], {
    cwd,
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
    void killChildProcess(child);
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

    if (isShutdownRequested() || timedOut) {
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

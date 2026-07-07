import { spawn } from 'node:child_process';

export function spawnManagedCommand(command, args, options = {}) {
  const {
    cwd,
    env,
    isWindows = process.platform === 'win32',
    label,
    spawnedChildren,
  } = options;
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env,
    shell: isWindows,
    detached: !isWindows,
  });
  spawnedChildren?.add(child);

  child.once('error', (error) => {
    console.error(`[vlaina] Failed to start ${label}:`, error);
  });

  child.once('exit', () => {
    spawnedChildren?.delete(child);
  });

  return child;
}

export function signalChildProcess(child, signal) {
  if (!child || child.killed || child.exitCode !== null) {
    return false;
  }

  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return true;
    } catch {}
  }

  try {
    child.kill(signal);
    return true;
  } catch {
    return false;
  }
}

export function killChildProcess(child) {
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

    if (!signalChildProcess(child, 'SIGTERM')) {
      resolve();
      return;
    }

    setTimeout(() => {
      if (child.exitCode === null) {
        signalChildProcess(child, 'SIGKILL');
      }
    }, 1500);
  });
}

export function signalSpawnedChildren(spawnedChildren, signal) {
  for (const child of spawnedChildren) {
    signalChildProcess(child, signal);
  }
}

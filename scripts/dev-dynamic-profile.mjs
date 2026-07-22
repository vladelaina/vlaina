import fs from 'node:fs';
import path from 'node:path';

export function getDevelopmentUserDataPath(repoRoot) {
  return path.join(repoRoot, 'temp', 'electron-user-data-dev');
}

export function ensureIsolatedDevelopmentUserDataPath(targetUserDataPath, options = {}) {
  const {
    fsModule = fs,
    log: logFn = () => {},
  } = options;

  fsModule.mkdirSync(targetUserDataPath, { recursive: true });

  const vlainaDataPath = path.join(targetUserDataPath, '.vlaina');
  try {
    const info = fsModule.lstatSync(vlainaDataPath);
    if (!info.isSymbolicLink()) {
      return;
    }

    fsModule.unlinkSync(vlainaDataPath);
    logFn('33', `Removed shared .vlaina symlink from isolated Electron userData: ${vlainaDataPath}`);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw error;
    }
  }

  fsModule.mkdirSync(vlainaDataPath, { recursive: true });
}

export function configureDevelopmentProfileEnv(env, port, options = {}) {
  if (env.VLAINA_USER_DATA_DIR?.trim()) {
    return env;
  }

  const {
    log: logFn = () => {},
    repoRoot,
    targetUserDataPath = getDevelopmentUserDataPath(repoRoot),
  } = options;
  ensureIsolatedDevelopmentUserDataPath(targetUserDataPath, { log: logFn });

  logFn(
    '33',
    `Using isolated Electron userData for dev port ${port}: ${targetUserDataPath}`
  );

  return {
    ...env,
    VLAINA_USER_DATA_DIR: targetUserDataPath,
  };
}

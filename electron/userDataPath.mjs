import fs from 'node:fs';
import path from 'node:path';

function isSameOrChildPath(rootPath, candidatePath) {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === '' || (
    !relativePath.startsWith('..') &&
    !path.isAbsolute(relativePath)
  );
}

function getPackagedInstallDirectories(runtime) {
  const installDirectories = [];
  if (typeof runtime?.execPath === 'string' && runtime.execPath.trim()) {
    installDirectories.push(path.dirname(path.resolve(runtime.execPath)));
  }

  if (typeof runtime?.resourcesPath === 'string' && runtime.resourcesPath.trim()) {
    const resourcesPath = path.resolve(runtime.resourcesPath);
    installDirectories.push(
      path.basename(resourcesPath).toLowerCase() === 'resources'
        ? path.dirname(resourcesPath)
        : resourcesPath
    );
  }

  return Array.from(new Set(installDirectories));
}

function isPackagedUserDataInsideInstallDirectory(userDataPath, runtime) {
  const resolvedUserDataPath = path.resolve(userDataPath);
  return getPackagedInstallDirectories(runtime)
    .some((installDirectory) => isSameOrChildPath(installDirectory, resolvedUserDataPath));
}

function getPackagedFallbackUserDataPath(app) {
  const appDataPath = app.getPath('appData');
  const appName = typeof app.getName === 'function' ? app.getName() : 'vlaina';
  const safeAppName = typeof appName === 'string' && appName.trim() ? appName.trim() : 'vlaina';
  return path.join(appDataPath, safeAppName);
}

function configurePackagedUserDataPath({
  app,
  runtime = process,
}) {
  const currentUserDataPath = app.getPath('userData');
  if (!isPackagedUserDataInsideInstallDirectory(currentUserDataPath, runtime)) {
    return {
      changed: false,
      userDataPath: currentUserDataPath,
    };
  }

  const fallbackUserDataPath = getPackagedFallbackUserDataPath(app);
  if (isPackagedUserDataInsideInstallDirectory(fallbackUserDataPath, runtime)) {
    return {
      changed: false,
      userDataPath: currentUserDataPath,
    };
  }

  fs.mkdirSync(fallbackUserDataPath, { recursive: true });
  app.setPath('userData', fallbackUserDataPath);
  return {
    changed: true,
    userDataPath: fallbackUserDataPath,
  };
}

export function configureDevelopmentUserDataPath({
  app,
  repoRoot,
  env = process.env,
  runtime = process,
}) {
  if (app.isPackaged) {
    return configurePackagedUserDataPath({ app, runtime });
  }

  const overridePath = env.VLAINA_USER_DATA_DIR?.trim();
  if (overridePath) {
    const userDataPath = path.resolve(overridePath);
    fs.mkdirSync(userDataPath, { recursive: true });
    app.setPath('userData', userDataPath);
    return {
      changed: true,
      userDataPath,
    };
  }

  return {
    changed: false,
    userDataPath: app.getPath('userData'),
  };
}

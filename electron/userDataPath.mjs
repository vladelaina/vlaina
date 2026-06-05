import fs from 'node:fs';
import path from 'node:path';

function resolveGitCommonRepoRoot(repoRoot) {
  const dotGitPath = path.join(repoRoot, '.git');

  try {
    const stat = fs.statSync(dotGitPath);
    if (stat.isDirectory()) {
      return repoRoot;
    }

    if (!stat.isFile()) {
      return repoRoot;
    }

    const content = fs.readFileSync(dotGitPath, 'utf8').trim();
    const match = /^gitdir:\s*(.+)$/i.exec(content);
    if (!match) {
      return repoRoot;
    }

    const gitDir = path.resolve(repoRoot, match[1]);
    const worktreesDir = path.dirname(gitDir);
    const commonGitDir = path.dirname(worktreesDir);

    if (
      path.basename(worktreesDir) !== 'worktrees' ||
      path.basename(commonGitDir) !== '.git'
    ) {
      return repoRoot;
    }

    return path.dirname(commonGitDir);
  } catch {
    return repoRoot;
  }
}

function hasAppData(userDataPath) {
  return fs.existsSync(path.join(userDataPath, '.vlaina'));
}

function normalizePathForCompare(filePath) {
  return path.resolve(filePath);
}

const DEVELOPMENT_PROFILE_SHELL_SEED_MARKER = '.vlaina-dev-profile-shell-seeded';
const MAX_DEVELOPMENT_PROFILE_SHELL_COPY_ENTRIES = 10000;
const MAX_DEVELOPMENT_PROFILE_SHELL_COPY_DEPTH = 32;
const MAX_DEVELOPMENT_PROFILE_SHELL_COPY_BYTES = 256 * 1024 * 1024;
const MAX_STARRED_REGISTRY_JSON_BYTES = 5 * 1024 * 1024;

function hasProfileShellData(userDataPath) {
  try {
    const dir = fs.opendirSync(userDataPath);
    try {
      for (;;) {
        const entry = dir.readSync();
        if (!entry) {
          return false;
        }

        if (
          entry.name !== '.vlaina' &&
          entry.name !== DEVELOPMENT_PROFILE_SHELL_SEED_MARKER
        ) {
          return true;
        }
      }
    } finally {
      dir.closeSync();
    }
  } catch {
    return false;
  }
}

function shouldCopyDevelopmentProfileShellPath(sourceUserDataPath, sourcePath) {
  const relativePath = path.relative(sourceUserDataPath, sourcePath);
  if (!relativePath) {
    return true;
  }

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return false;
  }

  const [topLevelName] = relativePath.split(/[\\/]+/);
  if (!topLevelName || topLevelName === '.vlaina') {
    return false;
  }

  if (
    topLevelName.startsWith('Singleton') ||
    topLevelName === DEVELOPMENT_PROFILE_SHELL_SEED_MARKER ||
    topLevelName === 'Crashpad' ||
    topLevelName === 'Cache' ||
    topLevelName === 'Code Cache' ||
    topLevelName === 'GPUCache' ||
    topLevelName === 'DawnGraphiteCache' ||
    topLevelName === 'DawnWebGPUCache'
  ) {
    return false;
  }

  return true;
}

function createDevelopmentProfileShellCopyBudget() {
  return {
    entries: 0,
    bytes: 0,
    stopped: false,
  };
}

function reserveDevelopmentProfileShellEntry(budget) {
  if (budget.stopped || budget.entries >= MAX_DEVELOPMENT_PROFILE_SHELL_COPY_ENTRIES) {
    budget.stopped = true;
    return false;
  }

  budget.entries += 1;
  return true;
}

function reserveDevelopmentProfileShellBytes(budget, byteLength) {
  if (
    budget.stopped ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 0 ||
    budget.bytes + byteLength > MAX_DEVELOPMENT_PROFILE_SHELL_COPY_BYTES
  ) {
    budget.stopped = true;
    return false;
  }

  budget.bytes += byteLength;
  return true;
}

function copyDevelopmentProfileShellChildren(
  sourceUserDataPath,
  sourcePath,
  targetPath,
  budget,
  depth
) {
  const dir = fs.opendirSync(sourcePath);
  try {
    for (;;) {
      if (budget.stopped) {
        return;
      }

      const entry = dir.readSync();
      if (!entry) {
        return;
      }

      copyDevelopmentProfileShellPath(
        sourceUserDataPath,
        path.join(sourcePath, entry.name),
        path.join(targetPath, entry.name),
        budget,
        depth + 1
      );
    }
  } finally {
    dir.closeSync();
  }
}

function copyDevelopmentProfileShellPath(
  sourceUserDataPath,
  sourcePath,
  targetPath,
  budget,
  depth = 0
) {
  if (
    budget.stopped ||
    depth > MAX_DEVELOPMENT_PROFILE_SHELL_COPY_DEPTH ||
    !shouldCopyDevelopmentProfileShellPath(sourceUserDataPath, sourcePath) ||
    !reserveDevelopmentProfileShellEntry(budget)
  ) {
    return;
  }

  const stat = fs.lstatSync(sourcePath);
  if (stat.isDirectory()) {
    if (depth >= MAX_DEVELOPMENT_PROFILE_SHELL_COPY_DEPTH) {
      return;
    }

    fs.mkdirSync(targetPath, { recursive: true });
    copyDevelopmentProfileShellChildren(
      sourceUserDataPath,
      sourcePath,
      targetPath,
      budget,
      depth
    );
    return;
  }

  if (stat.isSymbolicLink()) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.symlinkSync(fs.readlinkSync(sourcePath), targetPath);
    return;
  }

  if (stat.isFile()) {
    if (!reserveDevelopmentProfileShellBytes(budget, stat.size)) {
      return;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
  }
}

function seedDevelopmentProfileShell(sourceUserDataPath, targetUserDataPath) {
  const resolvedSourceUserDataPath = path.resolve(sourceUserDataPath);
  const resolvedTargetUserDataPath = path.resolve(targetUserDataPath);
  const seedMarkerPath = path.join(resolvedTargetUserDataPath, DEVELOPMENT_PROFILE_SHELL_SEED_MARKER);

  if (
    resolvedSourceUserDataPath === resolvedTargetUserDataPath ||
    !fs.existsSync(resolvedSourceUserDataPath) ||
    fs.existsSync(seedMarkerPath) ||
    hasProfileShellData(resolvedTargetUserDataPath)
  ) {
    return false;
  }

  try {
    fs.mkdirSync(resolvedTargetUserDataPath, { recursive: true });
    copyDevelopmentProfileShellChildren(
      resolvedSourceUserDataPath,
      resolvedSourceUserDataPath,
      resolvedTargetUserDataPath,
      createDevelopmentProfileShellCopyBudget(),
      -1
    );
    fs.writeFileSync(seedMarkerPath, `${new Date().toISOString()}\nsource=${resolvedSourceUserDataPath}\n`);
    return true;
  } catch (error) {
    return false;
  }
}

function linkSharedDevelopmentAppData(userDataPath, sharedAppDataPath) {
  const targetAppDataPath = path.join(userDataPath, '.vlaina');
  const resolvedSharedAppDataPath = path.resolve(sharedAppDataPath);

  fs.mkdirSync(path.dirname(resolvedSharedAppDataPath), { recursive: true });
  fs.mkdirSync(resolvedSharedAppDataPath, { recursive: true });
  fs.mkdirSync(userDataPath, { recursive: true });

  try {
    const stat = fs.lstatSync(targetAppDataPath);
    if (
      stat.isSymbolicLink() &&
      normalizePathForCompare(fs.realpathSync(targetAppDataPath)) ===
        normalizePathForCompare(fs.realpathSync(resolvedSharedAppDataPath))
    ) {
      return false;
    }

    throw new Error(
      `Refusing to replace existing development app data at ${targetAppDataPath}. ` +
        `Move or remove it manually before linking shared app data from ${resolvedSharedAppDataPath}.`
    );
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  fs.symlinkSync(
    resolvedSharedAppDataPath,
    targetAppDataPath,
    process.platform === 'win32' ? 'junction' : 'dir'
  );
  return true;
}

function getStarredRegistryPath(userDataPath) {
  return path.join(userDataPath, '.vlaina', 'store', 'notes-starred.json');
}

function readStarredEntries(userDataPath) {
  const registryPath = getStarredRegistryPath(userDataPath);
  if (!fs.existsSync(registryPath)) {
    return [];
  }

  try {
    const fileInfo = fs.statSync(registryPath);
    if (!fileInfo.isFile() || fileInfo.size > MAX_STARRED_REGISTRY_JSON_BYTES) {
      return [];
    }

    const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    return Array.isArray(parsed?.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

function getStarredEntryMergeKey(entry) {
  if (!entry || typeof entry !== 'object') {
    return JSON.stringify(entry);
  }

  const kind = typeof entry.kind === 'string' ? entry.kind : '';
  const vaultPath = typeof entry.vaultPath === 'string' ? entry.vaultPath : '';
  const relativePath = typeof entry.relativePath === 'string' ? entry.relativePath : '';
  if (kind || vaultPath || relativePath) {
    return `${kind}\0${vaultPath.replace(/\\/g, '/')}\0${relativePath.replace(/\\/g, '/')}`;
  }

  return typeof entry.id === 'string' ? `id\0${entry.id}` : JSON.stringify(entry);
}

function mergeLegacyStarredRegistry(legacyUserDataPath, targetUserDataPath) {
  if (legacyUserDataPath === targetUserDataPath || !hasAppData(legacyUserDataPath)) {
    return false;
  }

  const legacyEntries = readStarredEntries(legacyUserDataPath);
  if (legacyEntries.length === 0) {
    return false;
  }

  const targetEntries = readStarredEntries(targetUserDataPath);
  const knownKeys = new Set(targetEntries.map(getStarredEntryMergeKey));
  const mergedEntries = [...targetEntries];

  for (const entry of legacyEntries) {
    const key = getStarredEntryMergeKey(entry);
    if (knownKeys.has(key)) {
      continue;
    }
    knownKeys.add(key);
    mergedEntries.push(entry);
  }

  if (mergedEntries.length === targetEntries.length) {
    return false;
  }

  try {
    const targetPath = getStarredRegistryPath(targetUserDataPath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(
      targetPath,
      JSON.stringify({ version: 1, entries: mergedEntries }, null, 2),
      'utf8'
    );
    return true;
  } catch (error) {
    return false;
  }
}

export function seedDevelopmentAppData(defaultUserDataPath, targetUserDataPath) {
  const sourceAppDataPath = path.join(defaultUserDataPath, '.vlaina');
  const targetAppDataPath = path.join(targetUserDataPath, '.vlaina');
  const seedMarkerPath = path.join(targetUserDataPath, '.vlaina-dev-profile-seeded');

  if (
    defaultUserDataPath === targetUserDataPath ||
    fs.existsSync(seedMarkerPath) ||
    !fs.existsSync(sourceAppDataPath)
  ) {
    return false;
  }

  try {
    fs.mkdirSync(targetUserDataPath, { recursive: true });
    if (fs.existsSync(targetAppDataPath)) {
      const backupPath = path.join(
        targetUserDataPath,
        `.vlaina-pre-seed-backup-${Date.now()}`
      );
      fs.cpSync(targetAppDataPath, backupPath, {
        recursive: true,
        force: false,
        dereference: false,
      });
    }
    fs.cpSync(sourceAppDataPath, targetAppDataPath, {
      recursive: true,
      force: true,
      dereference: false,
    });
    fs.writeFileSync(seedMarkerPath, `${new Date().toISOString()}\nsource=${sourceAppDataPath}\n`);
    return true;
  } catch (error) {
    return false;
  }
}

export function configureDevelopmentUserDataPath({
  app,
  repoRoot,
  env = process.env,
}) {
  if (app.isPackaged) {
    return {
      changed: false,
      userDataPath: app.getPath('userData'),
      seeded: false,
    };
  }

  const defaultUserDataPath = app.getPath('userData');
  const overridePath = env.VLAINA_USER_DATA_DIR?.trim();
  if (overridePath) {
    const userDataPath = path.resolve(overridePath);
    const sharedUserDataPath = env.VLAINA_SHARED_USER_DATA_DIR?.trim();
    const sharedAppDataPath = env.VLAINA_SHARED_APP_DATA_DIR?.trim();
    fs.mkdirSync(userDataPath, { recursive: true });
    if (sharedUserDataPath) {
      seedDevelopmentProfileShell(sharedUserDataPath, userDataPath);
    }
    if (sharedAppDataPath) {
      linkSharedDevelopmentAppData(userDataPath, sharedAppDataPath);
    }
    app.setPath('userData', userDataPath);
    return {
      changed: true,
      userDataPath,
      seeded: false,
    };
  }

  const sharedRepoRoot = resolveGitCommonRepoRoot(repoRoot);
  const userDataPath = path.join(sharedRepoRoot, 'temp', 'electron-user-data');
  const legacyUserDataPath = path.join(repoRoot, 'temp', 'electron-user-data');
  const seedSourcePath = (
    legacyUserDataPath !== userDataPath &&
    hasAppData(legacyUserDataPath)
  )
    ? legacyUserDataPath
    : defaultUserDataPath;
  const seeded = hasAppData(userDataPath)
    ? false
    : seedDevelopmentAppData(seedSourcePath, userDataPath);
  mergeLegacyStarredRegistry(legacyUserDataPath, userDataPath);
  fs.mkdirSync(userDataPath, { recursive: true });
  app.setPath('userData', userDataPath);
  return {
    changed: true,
    userDataPath,
    seeded,
  };
}

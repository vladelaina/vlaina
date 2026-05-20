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

function getStarredRegistryPath(userDataPath) {
  return path.join(userDataPath, '.vlaina', 'store', 'notes-starred.json');
}

function readStarredEntries(userDataPath) {
  const registryPath = getStarredRegistryPath(userDataPath);
  if (!fs.existsSync(registryPath)) {
    return [];
  }

  try {
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
    console.error('[electron] Failed to merge legacy starred registry:', error);
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
    console.error('[electron] Failed to seed development app data:', error);
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
    fs.mkdirSync(userDataPath, { recursive: true });
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

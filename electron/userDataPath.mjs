import fs from 'node:fs';
import path from 'node:path';

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

  const userDataPath = path.join(repoRoot, 'temp', 'electron-user-data');
  const seeded = seedDevelopmentAppData(defaultUserDataPath, userDataPath);
  fs.mkdirSync(userDataPath, { recursive: true });
  app.setPath('userData', userDataPath);
  return {
    changed: true,
    userDataPath,
    seeded,
  };
}

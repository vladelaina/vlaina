import { getStorageAdapter, joinPath } from './adapter';
import { getStorageBasePath } from './basePath';

export async function getBasePath(): Promise<string> {
  return getStorageBasePath();
}

export async function getPaths() {
  const base = await getBasePath();
  const root = await joinPath(base, '.vlaina');
  const notes = await joinPath(root, 'notes');
  const chat = await joinPath(root, 'chat');
  const app = await joinPath(root, 'app');

  return {
    base,
    root,
    notes,
    chat,
    app,
    settingsJson: await joinPath(app, 'settings.json'),
    settingsBackupJson: await joinPath(app, 'settings.backup.json'),
    markdown: await joinPath(base, 'vlaina.md'),
  };
}

export async function ensureDirectories(): Promise<void> {
  try {
    const storage = getStorageAdapter();
    const { notes, chat, app } = await getPaths();

    for (const directory of [notes, chat, app]) {
      if (!(await storage.exists(directory))) {
        await storage.mkdir(directory, true);
      }
    }
  } catch (error) {
  }
}

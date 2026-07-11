import electron from 'electron';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { shell } = electron;

function findCommandOnPath(command, envPath = process.env.PATH, exists = existsSync) {
  if (!envPath) {
    return null;
  }

  for (const dirPath of envPath.split(path.delimiter)) {
    const commandPath = path.posix.join(dirPath, command);
    if (exists(commandPath)) {
      return commandPath;
    }
  }

  return null;
}

function escapeGVariantString(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const LINUX_ITEM_REVEALER_CANDIDATES = [
  { command: 'nautilus', args: ['--select'], target: 'item' },
  { command: 'dolphin', args: ['--select'], target: 'item' },
  { command: 'thunar', args: ['--select'], target: 'item' },
  { command: 'nemo', args: [], target: 'folder' },
  { command: 'pcmanfm', args: [], target: 'folder' },
  { command: 'caja', args: [], target: 'folder' },
  { command: 'io.elementary.files', args: [], target: 'folder' },
];

const LINUX_DIRECTORY_OPENER_CANDIDATES = [
  { command: 'nautilus', args: ['--new-window'] },
  { command: 'dolphin', args: ['--new-window'] },
  { command: 'thunar', args: ['--new-window'] },
  { command: 'nemo', args: ['--new-window'] },
  { command: 'pcmanfm', args: [] },
  { command: 'caja', args: [] },
  { command: 'io.elementary.files', args: [] },
];

const LINUX_XDG_OPEN_FOLDER_OPENER = { command: 'xdg-open', args: [], target: 'folder' };

function findLinuxCommandOpener(candidates, options = {}) {
  for (const candidate of candidates) {
    const commandPath = findCommandOnPath(candidate.command, options.envPath, options.exists);
    if (commandPath) {
      return { ...candidate, command: commandPath };
    }
  }

  return null;
}

function getLinuxFileManagerDbusRevealer(filePath, options = {}) {
  const commandPath = findCommandOnPath('gdbus', options.envPath, options.exists);
  if (!commandPath) {
    return null;
  }

  const fileUrl = pathToFileURL(filePath, { windows: false }).toString();
  return {
    command: commandPath,
    args: [
      'call',
      '--session',
      '--dest',
      'org.freedesktop.FileManager1',
      '--object-path',
      '/org/freedesktop/FileManager1',
      '--method',
      'org.freedesktop.FileManager1.ShowItems',
      `['${escapeGVariantString(fileUrl)}']`,
      '',
    ],
    target: 'none',
  };
}

function getLinuxCommandItemRevealer(options = {}) {
  return findLinuxCommandOpener(LINUX_ITEM_REVEALER_CANDIDATES, options)
    ?? LINUX_XDG_OPEN_FOLDER_OPENER;
}

function getLinuxDirectoryOpener(options = {}) {
  return findLinuxCommandOpener(LINUX_DIRECTORY_OPENER_CANDIDATES, options);
}

function getLinuxOpenerTargetPath(filePath, target) {
  if (target === 'none') {
    return null;
  }
  if (target === 'folder') {
    return path.dirname(filePath);
  }
  return filePath;
}

function getLinuxContainingFolderOpener(options = {}) {
  const folderOpener = getLinuxDirectoryOpener(options);
  return folderOpener
    ? { ...folderOpener, target: 'folder' }
    : LINUX_XDG_OPEN_FOLDER_OPENER;
}

function openItemWithLinuxFileManager(filePath, options = {}) {
  const opener = options.opener ?? getLinuxCommandItemRevealer(options);
  const { command, args, target } = opener;
  const spawnDetached = options.spawnDetached ?? spawn;
  const fallbackShell = options.fallbackShell ?? shell;
  const folderPath = path.dirname(filePath);
  const targetPath = getLinuxOpenerTargetPath(filePath, target);
  const spawnArgs = targetPath === null ? args : [...args, targetPath];
  let didFallback = false;

  const fallbackToContainingFolder = () => {
    if (didFallback) {
      return;
    }
    didFallback = true;

    if (options.disableFallback) {
      return;
    }

    if (options.fallbackOpener) {
      openItemWithLinuxFileManager(filePath, {
        ...options,
        opener: options.fallbackOpener,
        fallbackOpener: null,
      });
      return;
    }

    if (target === 'folder') {
      if (path.basename(command) === 'xdg-open') {
        void fallbackShell.openPath?.(folderPath);
        return;
      }

      openItemWithLinuxFileManager(filePath, {
        ...options,
        opener: { command: 'xdg-open', args: [], target: 'folder' },
      });
      return;
    }

    openItemWithLinuxFileManager(filePath, {
      ...options,
      opener: getLinuxContainingFolderOpener(options),
    });
  };

  const child = spawnDetached(command, spawnArgs, {
    detached: true,
    stdio: 'ignore',
  });

  child.once?.('error', fallbackToContainingFolder);
  child.once?.('exit', (code) => {
    if (code !== 0) {
      fallbackToContainingFolder();
    }
  });
  child.unref?.();
}

export async function openPathInFileManager(filePath, options = {}) {
  const platform = options.platform ?? process.platform;
  const shellImpl = options.shellImpl ?? shell;

  if (platform !== 'linux') {
    const errorMessage = await shellImpl.openPath(filePath);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
    return;
  }

  const opener = options.opener ?? getLinuxDirectoryOpener(options);
  if (!opener) {
    throw new Error('No supported Linux file manager was found for opening folders.');
  }

  const spawnDetached = options.spawnDetached ?? spawn;
  const child = spawnDetached(opener.command, [...opener.args, filePath], {
    detached: true,
    stdio: 'ignore',
  });
  child.once?.('error', () => {});
  child.unref?.();
}

export async function revealItemInFolder(filePath, options = {}) {
  const platform = options.platform ?? process.platform;
  const shellImpl = options.shellImpl ?? shell;

  if (platform === 'linux') {
    const dbusOpener = getLinuxFileManagerDbusRevealer(filePath, options);
    if (dbusOpener) {
      openItemWithLinuxFileManager(filePath, {
        ...options,
        fallbackShell: shellImpl,
        opener: dbusOpener,
        fallbackOpener: getLinuxCommandItemRevealer(options),
      });
      return;
    }

    openItemWithLinuxFileManager(filePath, {
      ...options,
      fallbackShell: shellImpl,
      opener: getLinuxCommandItemRevealer(options),
    });
    return;
  }

  shellImpl.showItemInFolder(filePath);
}

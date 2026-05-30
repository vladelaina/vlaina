import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const EXTERNAL_DIALOG_CANCEL_EXIT_CODES = new Set([1]);

export async function showExternalOpenDialog(options = {}) {
  if (!canUseExternalFileDialogs()) {
    return null;
  }

  const picker = findExternalDialogPicker();
  if (!picker) {
    return null;
  }

  const result = await runExternalDialog(picker, buildExternalOpenDialogArgs(picker, options));
  if (!result) {
    return null;
  }

  if (result.canceled) {
    return { canceled: true, filePaths: [] };
  }

  return {
    canceled: false,
    filePaths: parseExternalDialogPaths(result.stdout, options),
  };
}

export async function showExternalSaveDialog(options = {}) {
  if (!canUseExternalFileDialogs()) {
    return null;
  }

  const picker = findExternalDialogPicker();
  if (!picker) {
    return null;
  }

  const result = await runExternalDialog(picker, buildExternalSaveDialogArgs(picker, options));
  if (!result) {
    return null;
  }

  if (result.canceled) {
    return { canceled: true, filePath: undefined };
  }

  const filePath = parseExternalDialogPaths(result.stdout, options)[0];
  return {
    canceled: !filePath,
    filePath,
  };
}

function canUseExternalFileDialogs() {
  return (
    process.platform === 'linux'
    && process.env.NODE_ENV !== 'test'
    && process.env.VLAINA_DISABLE_EXTERNAL_FILE_DIALOGS !== '1'
  );
}

function findExternalDialogPicker(envPath = process.env.PATH, exists = existsSync) {
  const candidates = ['zenity', 'kdialog'];
  if (!envPath) {
    return null;
  }

  for (const command of candidates) {
    for (const dirPath of envPath.split(path.delimiter)) {
      const commandPath = path.join(dirPath, command);
      if (exists(commandPath)) {
        return { command, commandPath };
      }
    }
  }

  return null;
}

function buildExternalOpenDialogArgs(picker, options = {}) {
  if (picker.command === 'kdialog') {
    const args = [];
    if (options.title) {
      args.push('--title', options.title);
    }
    if (options.multiple) {
      args.push('--multiple', '--separate-output');
    }
    if (options.directory) {
      args.push('--getexistingdirectory', options.defaultPath ?? process.cwd());
    } else {
      args.push('--getopenfilename', options.defaultPath ?? process.cwd(), getKdialogFilter(options.filters));
    }
    return args;
  }

  const args = ['--file-selection', '--separator=\n'];
  if (options.title) {
    args.push('--title', options.title);
  }
  if (options.defaultPath) {
    args.push('--filename', options.defaultPath);
  }
  if (options.directory) {
    args.push('--directory');
  }
  if (options.multiple) {
    args.push('--multiple');
  }
  for (const filter of getZenityFilters(options.filters)) {
    args.push('--file-filter', filter);
  }
  return args;
}

function buildExternalSaveDialogArgs(picker, options = {}) {
  if (picker.command === 'kdialog') {
    const args = [];
    if (options.title) {
      args.push('--title', options.title);
    }
    args.push('--getsavefilename', options.defaultPath ?? process.cwd(), getKdialogFilter(options.filters));
    return args;
  }

  const args = ['--file-selection', '--save', '--confirm-overwrite'];
  if (options.title) {
    args.push('--title', options.title);
  }
  if (options.defaultPath) {
    args.push('--filename', options.defaultPath);
  }
  for (const filter of getZenityFilters(options.filters)) {
    args.push('--file-filter', filter);
  }
  return args;
}

function getZenityFilters(filters) {
  if (!Array.isArray(filters)) {
    return [];
  }

  return filters
    .map((filter) => {
      if (!filter?.name || !Array.isArray(filter.extensions) || filter.extensions.length === 0) {
        return null;
      }

      const patterns = filter.extensions
        .map((extension) => String(extension).replace(/^\.+/, '').trim())
        .filter(Boolean)
        .map((extension) => `*.${extension}`)
        .join(' ');
      return patterns ? `${filter.name} | ${patterns}` : null;
    })
    .filter(Boolean);
}

function getKdialogFilter(filters) {
  const zenityFilters = getZenityFilters(filters);
  if (zenityFilters.length === 0) {
    return '';
  }

  return zenityFilters.join('\n');
}

function parseExternalDialogPaths(stdout, options = {}) {
  const output = String(stdout ?? '').trim();
  if (!output) {
    return [];
  }

  if (options.multiple) {
    return output.split('\n').map((value) => value.trim()).filter(Boolean);
  }

  return [output.split('\n')[0].trim()].filter(Boolean);
}

function runExternalDialog(picker, args) {
  return new Promise((resolve) => {
    execFile(picker.commandPath, args, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (!error) {
        resolve({ canceled: false, stdout });
        return;
      }

      if (EXTERNAL_DIALOG_CANCEL_EXIT_CODES.has(error.code)) {
        resolve({ canceled: true, stdout: '' });
        return;
      }

      console.warn(
        `[vlaina] External file dialog failed (${picker.command}): ${stderr || error.message}`
      );
      resolve(null);
    });
  });
}

export const __testing__ = {
  buildExternalOpenDialogArgs,
  buildExternalSaveDialogArgs,
  canUseExternalFileDialogs,
  findExternalDialogPicker,
  getKdialogFilter,
  getZenityFilters,
  parseExternalDialogPaths,
};

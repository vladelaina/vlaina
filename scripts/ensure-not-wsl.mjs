import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function isWslRuntime() {
  if (process.platform !== 'linux') return false;
  if (process.env.WSL_INTEROP || process.env.WSL_DISTRO_NAME) return true;

  try {
    if (os.release().toLowerCase().includes('microsoft')) {
      return true;
    }
  } catch {}

  try {
    if (fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')) {
      return true;
    }
  } catch {}

  return false;
}

export function assertNotWsl(commandLabel = 'This command') {
  if (!isWslRuntime()) return;

  console.error(`[vlaina] ${commandLabel} is disabled in WSL.`);
  console.error('[vlaina] Keep editing files in WSL if you want, but run install/dev/build/test commands from Windows PowerShell or cmd.');
  process.exit(1);
}

function commandExists(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.error?.code !== 'ENOENT';
}

export function assertPackagingPrerequisites(commandLabel = 'This command') {
  if (commandLabel !== 'package:win' || process.platform === 'win32') return;
  if (commandExists('wine')) return;

  console.error('[vlaina] package:win requires wine when run outside Windows.');
  console.error('[vlaina] Install wine, or run package:win from Windows, before building the Windows installer.');
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const label = process.argv.slice(2).join(' ').trim() || 'This command';
  assertNotWsl(label);
  assertPackagingPrerequisites(label);
}

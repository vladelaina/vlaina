import fs from 'node:fs';
import os from 'node:os';
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

  console.error(`[Vlaina] ${commandLabel} is disabled in WSL.`);
  console.error('[Vlaina] Keep editing files in WSL if you want, but run install/dev/build/test commands from Windows PowerShell or cmd.');
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const label = process.argv.slice(2).join(' ').trim() || 'This command';
  assertNotWsl(label);
}

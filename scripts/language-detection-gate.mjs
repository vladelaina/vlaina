import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assertNotWsl } from './ensure-not-wsl.mjs';

const currentDir = dirname(fileURLToPath(import.meta.url));
const detectionDir = join(
  currentDir,
  '..',
  'src',
  'components',
  'Notes',
  'features',
  'Editor',
  'utils',
  'languageDetection',
);

function runPnpm(args) {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/c', 'pnpm', ...args], { encoding: 'utf8' });
  }
  return spawnSync('pnpm', args, { encoding: 'utf8' });
}

function getLanguageDetectionTests() {
  return readdirSync(detectionDir)
    .filter((entry) => entry.endsWith('.test.ts'))
    .sort()
    .map((entry) =>
      join(
        'src',
        'components',
        'Notes',
        'features',
        'Editor',
        'utils',
        'languageDetection',
        entry,
      ),
    );
}

function main() {
  assertNotWsl('quality:language-detection');

  const testFiles = getLanguageDetectionTests();
  if (testFiles.length === 0) {
    throw new Error('[LanguageDetectionGate] No language detection tests were found.');
  }

  console.log(`[LanguageDetectionGate] test files: ${testFiles.length}`);
  const result = runPnpm(['exec', 'vitest', 'run', ...testFiles]);
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  process.stdout.write(output);

  mkdirSync('temp', { recursive: true });
  const logPath = 'temp/language-detection-quality.log';
  writeFileSync(logPath, output, 'utf8');

  if (result.status !== 0) {
    throw new Error(`[LanguageDetectionGate] Failed with code ${result.status ?? 'unknown'}. Log: ${logPath}`);
  }

  console.log(`[LanguageDetectionGate] log saved: ${logPath}`);
  console.log('[LanguageDetectionGate] PASS');
}

main();

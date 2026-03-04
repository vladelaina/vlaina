import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { checkBuildBudget } from './check-build-budget.mjs';

function runPnpm(args) {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/c', 'pnpm', ...args], { encoding: 'utf8' });
  }
  return spawnSync('pnpm', args, { encoding: 'utf8' });
}

function runStep(label, args) {
  console.log(`[QualityGate] ${label}...`);
  const result = runPnpm(args);

  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0) {
    process.stdout.write(output);
    throw new Error(`[QualityGate] ${label} failed with code ${result.status ?? 'unknown'}.`);
  }

  process.stdout.write(output);
  return output;
}

function main() {
  runStep('Typecheck', ['exec', 'tsc', '--noEmit', '--pretty', 'false']);
  runStep('Tests', ['exec', 'vitest', 'run']);
  const buildLog = runStep('Build', ['build']);

  mkdirSync('temp', { recursive: true });
  const logPath = 'temp/build-quality-gate.log';
  writeFileSync(logPath, buildLog, 'utf8');

  const budgetResult = checkBuildBudget(buildLog);
  if (!budgetResult.ok) {
    for (const error of budgetResult.errors) {
      console.error(`[QualityGate][FAIL] ${error}`);
    }
    throw new Error('[QualityGate] Build budget check failed.');
  }

  const { mainIndexChunk, chunksOver500Kb, unresolvedWarnings } = budgetResult.stats;
  console.log(`[QualityGate] unresolved warnings: ${unresolvedWarnings}`);
  console.log(
    `[QualityGate] main index chunk: ${mainIndexChunk.file || 'N/A'} ${mainIndexChunk.sizeKb.toFixed(2)} kB`,
  );
  console.log(`[QualityGate] chunks >500k: ${chunksOver500Kb.length}`);
  console.log(`[QualityGate] build log saved: ${logPath}`);
  console.log('[QualityGate] PASS');
}

main();

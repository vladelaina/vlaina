import { readFileSync } from 'node:fs';

const DEFAULT_BUDGET = {
  maxMainIndexKb: 1500,
  maxChunksOver500Kb: 2,
  maxUnresolvedWarnings: 0,
};

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function parseChunkStats(logText) {
  const cleaned = stripAnsi(logText);
  const chunkRegex = /assets\/([^\s]+\.js)\s+([0-9][0-9,]*\.[0-9]+)\s*kB/g;
  const chunks = [];
  let match = null;
  while ((match = chunkRegex.exec(cleaned)) !== null) {
    chunks.push({
      file: match[1],
      sizeKb: parseFloat(match[2].replace(/,/g, '')),
    });
  }

  const indexChunks = chunks.filter((chunk) => /^index-.*\.js$/.test(chunk.file));
  const mainIndexChunk = indexChunks.reduce(
    (largest, current) => (current.sizeKb > largest.sizeKb ? current : largest),
    { file: '', sizeKb: 0 },
  );

  const chunksOver500Kb = chunks.filter((chunk) => chunk.sizeKb > 500);
  const unresolvedWarnings = (cleaned.match(/didn't resolve at build time/g) || []).length;

  return {
    mainIndexChunk,
    chunksOver500Kb,
    unresolvedWarnings,
  };
}

export function checkBuildBudget(logText, budget = DEFAULT_BUDGET) {
  const stats = parseChunkStats(logText);
  const errors = [];

  if (!stats.mainIndexChunk.file) {
    errors.push('Main index chunk not found in build log (parse failure).');
  }

  if (stats.chunksOver500Kb.length === 0 && stats.mainIndexChunk.sizeKb === 0) {
    errors.push('No JS chunk stats parsed from build log (parse failure).');
  }

  if (stats.unresolvedWarnings > budget.maxUnresolvedWarnings) {
    errors.push(
      `Unresolved asset warnings: ${stats.unresolvedWarnings} > ${budget.maxUnresolvedWarnings}`,
    );
  }

  if (stats.mainIndexChunk.sizeKb > budget.maxMainIndexKb) {
    errors.push(
      `Main index chunk too large: ${stats.mainIndexChunk.sizeKb.toFixed(2)} kB > ${budget.maxMainIndexKb} kB`,
    );
  }

  if (stats.chunksOver500Kb.length > budget.maxChunksOver500Kb) {
    errors.push(
      `Chunks >500 kB: ${stats.chunksOver500Kb.length} > ${budget.maxChunksOver500Kb}`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    stats,
  };
}

function runCli() {
  const logPath = process.argv[2];
  if (!logPath) {
    console.error('Usage: node scripts/check-build-budget.mjs <build-log-path>');
    process.exit(1);
  }

  const logText = readFileSync(logPath, 'utf8');
  const result = checkBuildBudget(logText);

  const { mainIndexChunk, chunksOver500Kb, unresolvedWarnings } = result.stats;
  console.log(`[Budget] unresolved warnings: ${unresolvedWarnings}`);
  console.log(
    `[Budget] main index chunk: ${mainIndexChunk.file || 'N/A'} ${mainIndexChunk.sizeKb.toFixed(2)} kB`,
  );
  console.log(`[Budget] chunks >500k: ${chunksOver500Kb.length}`);

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`[Budget][FAIL] ${error}`);
    }
    process.exit(1);
  }

  console.log('[Budget][PASS] Build budget checks passed.');
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith('check-build-budget.mjs');
if (isDirectRun) {
  runCli();
}

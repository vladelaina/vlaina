import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalizeCodeBlockLanguage } from '../../plugins/code/codeBlockLanguage';
import { guessLanguage } from './index';

const RANDOM_PASTE_SEED = 20260512;
const SAMPLE_COUNT = 96;

const words = fc.constantFrom('api', 'web', 'worker', 'notes', 'assets', 'prod', 'staging', 'cache');
const packageManagers = fc.constantFrom('pnpm', 'npm', 'yarn', 'bun');
const cliTools = fc.constantFrom('wrangler', 'vite', 'vitest', 'docker', 'gh', 'kubectl', 'terraform');
const options = fc.constantFrom('--config ./wrangler.toml', '--format pretty', '--watch', '--verbose', '--dry-run');

function normalize(language: string | null | undefined) {
  return normalizeCodeBlockLanguage(language) ?? language ?? null;
}

function expectLanguage(samples: readonly string[], expected: string | null) {
  const failures = samples.flatMap((sample) => {
    const actual = guessLanguage(sample);
    return normalize(actual) === normalize(expected)
      ? []
      : [`actual=${actual ?? 'null'} sample=${sample.replace(/\n/g, '\\n')}`];
  });

  expect(failures).toEqual([]);
}

describe('guessLanguage random paste snippets', () => {
  it('classifies short pasted shell command sequences as bash', () => {
    const samples = fc.sample(
      fc.oneof(
        fc.tuple(words, packageManagers, cliTools, options).map(
          ([folder, pm, tool, option]) => `cd ${folder}\n\n${pm} exec ${tool} ${folder}\n  ${option}`,
        ),
        fc.tuple(packageManagers, words).map(
          ([pm, script]) => `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 ${pm} run ${script}\n${pm} test -- --run`,
        ),
        fc.tuple(words, options).map(([folder, option]) => `./scripts/${folder}.sh ${option}`),
        fc.tuple(words).map(([folder]) => `chmod +x ./scripts/${folder}.sh\n./scripts/${folder}.sh`),
      ),
      { numRuns: SAMPLE_COUNT, seed: RANDOM_PASTE_SEED },
    );

    expectLanguage(samples, 'bash');
  });

  it('classifies standalone pasted HTML comments as html', () => {
    const samples = fc.sample(
      fc.tuple(words, words).map(([a, b]) => `<!--${a} ${b}-->`),
      { numRuns: SAMPLE_COUNT, seed: RANDOM_PASTE_SEED + 1 },
    );

    expectLanguage(samples, 'html');
  });

  it('does not treat prose containing an HTML comment as a code language', () => {
    const samples = fc.sample(
      fc.tuple(words, words).map(([a, b]) => `Remember ${a} <!--${b}--> after lunch.`),
      { numRuns: SAMPLE_COUNT, seed: RANDOM_PASTE_SEED + 2 },
    );

    expectLanguage(samples, null);
  });

  it('keeps Dockerfile ENV distinct from shell env commands', () => {
    const dockerfileSamples = fc.sample(
      fc.tuple(words, words).map(([name, value]) => `ENV ${name.toUpperCase()}=${value}`),
      { numRuns: SAMPLE_COUNT, seed: RANDOM_PASTE_SEED + 3 },
    );
    const shellSamples = fc.sample(
      fc.tuple(words, packageManagers, words).map(
        ([name, pm, script]) => `env ${name.toUpperCase()}=production ${pm} run ${script}`,
      ),
      { numRuns: SAMPLE_COUNT, seed: RANDOM_PASTE_SEED + 4 },
    );

    expectLanguage(dockerfileSamples, 'dockerfile');
    expectLanguage(shellSamples, 'bash');
  });
});

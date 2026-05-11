import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readText(path: string) {
  return readFileSync(path, 'utf8');
}

describe('typecheck quality gate', () => {
  it('keeps TypeScript unused-symbol checks enabled', () => {
    const tsconfig = readText('tsconfig.json');

    expect(tsconfig).toMatch(/"noUnusedLocals"\s*:\s*true/);
    expect(tsconfig).toMatch(/"noUnusedParameters"\s*:\s*true/);
  });

  it('keeps the typecheck script wired to tsc no-emit', () => {
    const packageJson = JSON.parse(readText('package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.typecheck).toContain('tsc --noEmit');
  });

  it('runs typecheck in the GitHub Actions test job', () => {
    const workflow = readText('.github/workflows/build.yml');

    expect(workflow).toMatch(/run:\s*pnpm typecheck/);
  });
});

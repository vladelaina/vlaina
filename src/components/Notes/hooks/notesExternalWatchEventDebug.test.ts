import { describe, expect, it } from 'vitest';
import {
  markExpectedExternalChange,
  shouldIgnoreExpectedExternalChange,
} from '@/stores/notes/document/externalChangeRegistry';
import { classifyWatchEventPaths } from './notesExternalWatchEventDebug';

describe('notesExternalWatchEventDebug', () => {
  it('does not spend expected-change markers on ignored vault paths', () => {
    const vaultPath = '/vault-watch-ignore-test';
    markExpectedExternalChange(vaultPath, true);

    const result = classifyWatchEventPaths(vaultPath, [
      `${vaultPath}/.vlaina/internal.json`,
      `${vaultPath}/.vlaina/sync.json`,
      `${vaultPath}/.vlaina/internal.json`,
      `${vaultPath}/docs/.git/config`,
      `${vaultPath}/.vlaina/cache.tmp`,
    ]);

    expect(result.pathDetails.every((detail) => detail.ignoredByVaultRules)).toBe(true);
    expect(result.pathDetails.every((detail) => !detail.expectedChange)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${vaultPath}/docs/a.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${vaultPath}/docs/b.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${vaultPath}/docs/c.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${vaultPath}/docs/d.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${vaultPath}/docs/e.md`)).toBe(false);
  });

  it('does not spend expected-change markers on paths outside the vault', () => {
    const vaultPath = '/vault-watch-outside-test';
    markExpectedExternalChange(`${vaultPath}/docs/a.md`);

    const result = classifyWatchEventPaths(vaultPath, ['/outside/docs/a.md']);

    expect(result.pathDetails[0]?.insideVault).toBe(false);
    expect(result.pathDetails[0]?.expectedChange).toBe(false);
    expect(shouldIgnoreExpectedExternalChange(`${vaultPath}/docs/a.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${vaultPath}/docs/a.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${vaultPath}/docs/a.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${vaultPath}/docs/a.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${vaultPath}/docs/a.md`)).toBe(false);
  });
});

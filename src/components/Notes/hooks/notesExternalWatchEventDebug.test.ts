import { describe, expect, it } from 'vitest';
import {
  markExpectedExternalChange,
  shouldIgnoreExpectedExternalChange,
} from '@/stores/notes/document/externalChangeRegistry';
import { classifyWatchEventPaths } from './notesExternalWatchEventDebug';

describe('notesExternalWatchEventDebug', () => {
  it('does not spend expected-change markers on ignored opened folder paths', () => {
    const notesRootPath = '/notes-root-watch-ignore-test';
    markExpectedExternalChange(notesRootPath, true);

    const result = classifyWatchEventPaths(notesRootPath, [
      `${notesRootPath}/.vlaina/internal.json`,
      `${notesRootPath}/.vlaina/sync.json`,
      `${notesRootPath}/.vlaina/internal.json`,
      `${notesRootPath}/docs/.git/config`,
      `${notesRootPath}/.vlaina/cache.tmp`,
    ]);

    expect(result.pathDetails.every((detail) => detail.ignoredByNotesRootRules)).toBe(true);
    expect(result.pathDetails.every((detail) => !detail.expectedChange)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${notesRootPath}/docs/a.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${notesRootPath}/docs/b.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${notesRootPath}/docs/c.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${notesRootPath}/docs/d.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${notesRootPath}/docs/e.md`)).toBe(false);
  });

  it('does not spend expected-change markers on paths outside the notesRoot', () => {
    const notesRootPath = '/notes-root-watch-outside-test';
    markExpectedExternalChange(`${notesRootPath}/docs/a.md`);

    const result = classifyWatchEventPaths(notesRootPath, ['/outside/docs/a.md']);

    expect(result.pathDetails[0]?.insideNotesRoot).toBe(false);
    expect(result.pathDetails[0]?.expectedChange).toBe(false);
    expect(shouldIgnoreExpectedExternalChange(`${notesRootPath}/docs/a.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${notesRootPath}/docs/a.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${notesRootPath}/docs/a.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${notesRootPath}/docs/a.md`)).toBe(true);
    expect(shouldIgnoreExpectedExternalChange(`${notesRootPath}/docs/a.md`)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildWindowLaunchSearch,
  readWindowLaunchContext,
} from './windowLaunchContext';

describe('windowLaunchContext', () => {
  it('builds a new-window search string with launch targets', () => {
    expect(
      buildWindowLaunchSearch({
        vaultPath: 'C:/vault',
        notePath: 'docs/note.md',
      })
    ).toBe('?newWindow=true&vaultPath=C%3A%2Fvault&notePath=docs%2Fnote.md');
  });

  it('omits empty launch targets', () => {
    expect(
      buildWindowLaunchSearch({
        vaultPath: '   ',
        notePath: '',
      })
    ).toBe('?newWindow=true');
  });

  it('reads launch context from search params', () => {
    expect(
      readWindowLaunchContext('?newWindow=true&vaultPath=C%3A%2Fvault&notePath=docs%2Fnote.md')
    ).toEqual({
      isNewWindow: true,
      vaultPath: 'C:/vault',
      notePath: 'docs/note.md',
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildWindowLaunchSearch,
  readWindowLaunchContext,
} from './launchContext';

describe('launchContext', () => {
  it('builds a new-window search string with launch targets', () => {
    expect(
      buildWindowLaunchSearch({
        vaultPath: 'C:/vault',
        notePath: 'docs/note.md',
        folderPath: 'docs',
        chatSessionId: 'session-1',
      })
    ).toBe('?newWindow=true&vaultPath=C%3A%2Fvault&notePath=docs%2Fnote.md&folderPath=docs&chatSessionId=session-1');
  });

  it('omits empty launch targets', () => {
    expect(
      buildWindowLaunchSearch({
        vaultPath: '   ',
        notePath: '',
        folderPath: ' ',
        chatSessionId: '',
      })
    ).toBe('?newWindow=true');
  });

  it('reads launch context from search params', () => {
    expect(
      readWindowLaunchContext('?newWindow=true&vaultPath=C%3A%2Fvault&notePath=docs%2Fnote.md&folderPath=docs&chatSessionId=session-1')
    ).toEqual({
      isNewWindow: true,
      vaultPath: 'C:/vault',
      notePath: 'docs/note.md',
      folderPath: 'docs',
      chatSessionId: 'session-1',
      viewMode: null,
    });
  });
});

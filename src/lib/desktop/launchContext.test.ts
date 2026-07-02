import { describe, expect, it } from 'vitest';
import {
  buildWindowLaunchSearch,
  readWindowLaunchContext,
} from './launchContext';

describe('launchContext', () => {
  it('builds a new-window search string with launch targets', () => {
    expect(
      buildWindowLaunchSearch({
        notesRootPath: 'C:/notesRoot',
        notePath: 'docs/note.md',
        folderPath: 'docs',
        chatSessionId: 'session-1',
      })
    ).toBe('?newWindow=true&notesRootPath=C%3A%2FnotesRoot&notePath=docs%2Fnote.md&folderPath=docs&chatSessionId=session-1');
  });

  it('omits empty launch targets', () => {
    expect(
      buildWindowLaunchSearch({
        notesRootPath: '   ',
        notePath: '',
        folderPath: ' ',
        chatSessionId: '',
      })
    ).toBe('?newWindow=true');
  });

  it('reads launch context from search params', () => {
    expect(
      readWindowLaunchContext('?newWindow=true&notesRootPath=C%3A%2FnotesRoot&notePath=docs%2Fnote.md&folderPath=docs&chatSessionId=session-1')
    ).toEqual({
      isNewWindow: true,
      notesRootPath: 'C:/notesRoot',
      notePath: 'docs/note.md',
      folderPath: 'docs',
      chatSessionId: 'session-1',
      viewMode: null,
    });
  });
});

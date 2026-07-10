import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildMentionedNotesContext: vi.fn(() => 'Referenced notes'),
  buildMessageFileAttachmentContext: vi.fn(),
  loadMentionedFolderImageAttachments: vi.fn(),
  loadMentionedNotes: vi.fn(),
}));

vi.mock('./helpers', async (importOriginal) => ({
  ...await importOriginal<typeof import('./helpers')>(),
  buildMentionedNotesContext: mocks.buildMentionedNotesContext,
  buildMessageFileAttachmentContext: mocks.buildMessageFileAttachmentContext,
  loadMentionedFolderImageAttachments: mocks.loadMentionedFolderImageAttachments,
  loadMentionedNotes: mocks.loadMentionedNotes,
}));

import { buildSendMessageApiContent } from './sendMessagePayloads';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('send message payload preparation', () => {
  beforeEach(() => {
    mocks.buildMentionedNotesContext.mockClear();
    mocks.buildMessageFileAttachmentContext.mockReset();
    mocks.loadMentionedFolderImageAttachments.mockReset();
    mocks.loadMentionedNotes.mockReset();
  });

  it('loads note, folder image, and file contexts in parallel', async () => {
    const notes = deferred<Array<{ path: string; title: string; kind: 'note'; content: string }>>();
    const folderImages = deferred<never[]>();
    const fileContext = deferred<string>();
    mocks.loadMentionedNotes.mockReturnValue(notes.promise);
    mocks.loadMentionedFolderImageAttachments.mockReturnValue(folderImages.promise);
    mocks.buildMessageFileAttachmentContext.mockReturnValue(fileContext.promise);

    const request = buildSendMessageApiContent({
      requestAttachments: [],
      userMessageText: 'Question',
      noteMentions: [],
      signal: new AbortController().signal,
    });

    await vi.waitFor(() => {
      expect(mocks.loadMentionedNotes).toHaveBeenCalledOnce();
      expect(mocks.loadMentionedFolderImageAttachments).toHaveBeenCalledOnce();
      expect(mocks.buildMessageFileAttachmentContext).toHaveBeenCalledOnce();
    });

    notes.resolve([{ path: 'notes/a.md', title: 'A', kind: 'note', content: 'A' }]);
    folderImages.resolve([]);
    fileContext.resolve('Attached files');

    await expect(request).resolves.toBe('Referenced notes\n\nUser request:\nAttached files\n\nQuestion');
  });

  it('reuses the file context prepared for message storage', async () => {
    mocks.loadMentionedNotes.mockResolvedValue([]);
    mocks.loadMentionedFolderImageAttachments.mockResolvedValue([]);
    mocks.buildMentionedNotesContext.mockReturnValueOnce('');

    await expect(buildSendMessageApiContent({
      requestAttachments: [],
      userMessageText: 'Question',
      noteMentions: [],
      signal: new AbortController().signal,
      fileAttachmentContext: 'Prepared attachment',
    })).resolves.toBe('Prepared attachment\n\nQuestion');

    expect(mocks.buildMessageFileAttachmentContext).not.toHaveBeenCalled();
  });
});

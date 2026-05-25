import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import {
  buildMessageImageSources,
  buildStoredUserMessageContent,
  loadMentionedNotes,
  refreshManagedBudgetIfNeeded,
} from './helpers';

const mocks = vi.hoisted(() => ({
  isConnected: false,
  refreshBudget: vi.fn().mockResolvedValue(undefined),
  flushCurrentPendingEditorMarkdown: vi.fn(),
  notesState: {
    currentNote: null as { path: string; content: string } | null,
    noteContentsCache: new Map<string, { content: string }>(),
    notesPath: '/vault',
  },
}));

vi.mock('@/stores/accountSession', () => ({
  useAccountSessionStore: {
    getState: () => ({
      isConnected: mocks.isConnected,
    }),
  },
}));

vi.mock('@/stores/useManagedAIStore', () => ({
  useManagedAIStore: {
    getState: () => ({
      refreshBudget: mocks.refreshBudget,
    }),
  },
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: {
    getState: () => mocks.notesState,
  },
}));

vi.mock('@/stores/notes/pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: mocks.flushCurrentPendingEditorMarkdown,
}));

function createAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'attachment-1',
    path: '/home/user/.vlaina/attachments/demo image.png',
    previewUrl: 'data:image/png;base64,PREVIEW',
    assetUrl: 'file:///home/user/.vlaina/attachments/demo%20image.png',
    name: 'demo image.png',
    type: 'image/png',
    size: 123,
    ...overrides,
  };
}

describe('chat service helpers', () => {
  beforeEach(() => {
    mocks.isConnected = false;
    mocks.refreshBudget.mockClear();
    mocks.flushCurrentPendingEditorMarkdown.mockClear();
    mocks.notesState.currentNote = null;
    mocks.notesState.noteContentsCache = new Map();
    mocks.notesState.notesPath = '/vault';
  });

  it('does not refresh budget for custom providers', () => {
    mocks.isConnected = true;

    refreshManagedBudgetIfNeeded('provider-1');

    expect(mocks.refreshBudget).not.toHaveBeenCalled();
  });

  it('does not refresh budget for managed providers after sign-out', () => {
    mocks.isConnected = false;

    refreshManagedBudgetIfNeeded('vlaina-managed');

    expect(mocks.refreshBudget).not.toHaveBeenCalled();
  });

  it('refreshes budget for managed providers while signed in', () => {
    mocks.isConnected = true;

    refreshManagedBudgetIfNeeded('vlaina-managed');

    expect(mocks.refreshBudget).toHaveBeenCalledTimes(1);
  });

  it('stores local attachment references without exposing file URLs in chat content', () => {
    const result = buildMessageImageSources([createAttachment()]);

    expect(result.imageSources).toEqual(['attachment://demo%20image.png']);
    expect(result.content).toBe('![image](<attachment://demo%20image.png>)');
    expect(result.content).not.toContain('file://');
  });

  it('falls back to inline preview data when no persisted attachment path exists', () => {
    const result = buildMessageImageSources([
      createAttachment({
        path: '',
        assetUrl: '',
        previewUrl: 'data:image/png;base64,INLINE',
      }),
    ]);

    expect(result.imageSources).toEqual(['data:image/png;base64,INLINE']);
    expect(result.content).toBe('![image](<data:image/png;base64,INLINE>)');
  });

  it('converts stored user image markdown into vision message parts for resend paths', async () => {
    const content = '![image](<data:image/png;base64,INLINE>)\n\nDescribe this';

    await expect(buildStoredUserMessageContent(content)).resolves.toEqual([
      { type: 'text', text: 'Describe this' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,INLINE' } },
    ]);
  });
});

describe('loadMentionedNotes', () => {
  beforeEach(() => {
    mocks.flushCurrentPendingEditorMarkdown.mockClear();
    mocks.notesState.currentNote = null;
    mocks.notesState.noteContentsCache = new Map();
    mocks.notesState.notesPath = '/vault';
  });

  it('flushes pending editor markdown before reading the current note mention', async () => {
    mocks.notesState.currentNote = { path: 'docs/alpha.md', content: '# old' };
    mocks.notesState.noteContentsCache = new Map([
      ['docs/alpha.md', { content: '# old' }],
    ]);
    mocks.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      mocks.notesState.currentNote = {
        path: 'docs/alpha.md',
        content: '# pending edit',
      };
      mocks.notesState.noteContentsCache = new Map([
        ['docs/alpha.md', { content: '# pending edit' }],
      ]);
      return true;
    });

    const notes = await loadMentionedNotes([
      { path: 'docs/alpha.md', title: 'Alpha' },
    ]);

    expect(mocks.flushCurrentPendingEditorMarkdown).toHaveBeenCalledTimes(1);
    expect(notes).toEqual([
      { path: 'docs/alpha.md', title: 'Alpha', content: '# pending edit' },
    ]);
  });
});

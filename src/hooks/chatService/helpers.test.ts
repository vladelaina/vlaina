import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import {
  buildMessageImageSources,
  buildStoredUserMessageContent,
  loadMentionedFolderImageAttachments,
  loadMentionedNotes,
  refreshManagedBudgetIfNeeded,
} from './helpers';

const mocks = vi.hoisted(() => ({
  isConnected: false,
  refreshBudget: vi.fn().mockResolvedValue(undefined),
  flushCurrentPendingEditorMarkdown: vi.fn(),
  storage: {
    listDir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
  },
  notesState: {
    currentNote: null as { path: string; content: string } | null,
    noteContentsCache: new Map<string, { content: string }>(),
    notesPath: '/vault',
    rootFolder: null as null | { children: unknown[] },
    getDisplayName: vi.fn((path: string) => path.split('/').pop()?.replace(/\.md$/i, '') ?? path),
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

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
  joinPath: async (...segments: string[]) => segments.filter(Boolean).join('/').replace(/\/+/g, '/'),
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
    mocks.flushCurrentPendingEditorMarkdown.mockReset();
    mocks.storage.listDir.mockReset();
    mocks.storage.stat.mockReset();
    mocks.storage.readFile.mockReset();
    mocks.notesState.currentNote = null;
    mocks.notesState.noteContentsCache = new Map();
    mocks.notesState.notesPath = '/vault';
    mocks.notesState.rootFolder = null;
    mocks.notesState.getDisplayName.mockClear();
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
    mocks.flushCurrentPendingEditorMarkdown.mockReset();
    mocks.notesState.currentNote = null;
    mocks.notesState.noteContentsCache = new Map();
    mocks.notesState.notesPath = '/vault';
    mocks.notesState.rootFolder = null;
    mocks.notesState.getDisplayName.mockClear();
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

  it('includes folder listing and markdown notes for mixed folder mentions', async () => {
    mocks.notesState.rootFolder = {
      children: [
        {
          id: 'docs',
          name: 'docs',
          path: 'docs',
          isFolder: true,
          expanded: true,
          children: [
            { id: 'docs/a.md', name: 'a.md', path: 'docs/a.md', isFolder: false },
            { id: 'docs/skip.txt', name: 'skip.txt', path: 'docs/skip.txt', isFolder: false },
            {
              id: 'docs/nested',
              name: 'nested',
              path: 'docs/nested',
              isFolder: true,
              expanded: true,
              children: [
                { id: 'docs/nested/b.md', name: 'b.md', path: 'docs/nested/b.md', isFolder: false },
              ],
            },
          ],
        },
      ],
    };
    mocks.notesState.noteContentsCache = new Map([
      ['docs/a.md', { content: '# A' }],
      ['docs/nested/b.md', { content: '# B' }],
    ]);
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'a.md',
        path: '/vault/docs/a.md',
        isDirectory: false,
        isFile: true,
        size: 32,
      },
      {
        name: 'cover.png',
        path: '/vault/docs/cover.png',
        isDirectory: false,
        isFile: true,
        size: 4096,
      },
      {
        name: 'nested',
        path: '/vault/docs/nested',
        isDirectory: true,
        isFile: false,
      },
    ]);
    mocks.notesState.getDisplayName.mockImplementation((path: string) =>
      path === 'docs/a.md' ? 'A' : path === 'docs/nested/b.md' ? 'B' : path,
    );

    const notes = await loadMentionedNotes([
      { path: 'docs', title: 'Docs', kind: 'folder' },
    ]);

    expect(notes).toHaveLength(3);
    expect(notes[0]).toMatchObject({
      path: 'docs',
      title: 'Docs',
      kind: 'folder',
    });
    expect(notes[0]?.content).toContain('Directory listing:');
    expect(notes[0]?.content).toContain('- cover.png (file, 4.0 KB)');
    expect(notes.slice(1)).toEqual([
      { path: 'docs/a.md', title: 'Docs/A', kind: 'note', content: '# A' },
      { path: 'docs/nested/b.md', title: 'Docs/B', kind: 'note', content: '# B' },
    ]);
  });

  it('includes a directory listing for folder mentions without markdown notes', async () => {
    mocks.notesState.rootFolder = {
      children: [
        {
          id: 'assets',
          name: 'assets',
          path: 'assets',
          isFolder: true,
          expanded: true,
          children: [],
        },
      ],
    };
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'cover.png',
        path: '/vault/assets/cover.png',
        isDirectory: false,
        isFile: true,
        size: 2048,
      },
      {
        name: 'icons',
        path: '/vault/assets/icons',
        isDirectory: true,
        isFile: false,
      },
    ]);

    const notes = await loadMentionedNotes([
      { path: 'assets', title: 'assets/', kind: 'folder' },
    ]);

    expect(mocks.storage.listDir).toHaveBeenCalledWith('/vault/assets');
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      path: 'assets',
      title: 'assets/',
      kind: 'folder',
    });
    expect(notes[0]?.content).toContain('Directory listing:');
    expect(notes[0]?.content).toContain('- icons (folder)');
    expect(notes[0]?.content).toContain('- cover.png (file, 2.0 KB)');
  });
});

describe('loadMentionedFolderImageAttachments', () => {
  beforeEach(() => {
    mocks.storage.listDir.mockReset();
    mocks.storage.stat.mockReset();
    mocks.notesState.notesPath = '/vault';
    mocks.notesState.rootFolder = null;
  });

  it('creates image attachments from selected folder mentions', async () => {
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'cover.png',
        path: '/vault/assets/cover.png',
        isDirectory: false,
        isFile: true,
        size: 2048,
      },
      {
        name: 'diagram.webp',
        path: '/vault/assets/diagram.webp',
        isDirectory: false,
        isFile: true,
        size: 4096,
      },
      {
        name: 'readme.md',
        path: '/vault/assets/readme.md',
        isDirectory: false,
        isFile: true,
        size: 128,
      },
    ]);

    const attachments = await loadMentionedFolderImageAttachments([
      { path: 'assets', title: 'assets/', kind: 'folder' },
    ]);

    expect(mocks.storage.listDir).toHaveBeenCalledWith('/vault/assets');
    expect(attachments).toEqual([
      {
        id: 'folder-image:/vault/assets/cover.png',
        path: '/vault/assets/cover.png',
        previewUrl: '',
        assetUrl: '',
        name: 'cover.png',
        type: 'image/png',
        size: 2048,
      },
      {
        id: 'folder-image:/vault/assets/diagram.webp',
        path: '/vault/assets/diagram.webp',
        previewUrl: '',
        assetUrl: '',
        name: 'diagram.webp',
        type: 'image/webp',
        size: 4096,
      },
    ]);
  });

  it('skips hidden and oversized folder images', async () => {
    mocks.storage.listDir.mockResolvedValue([
      {
        name: '.hidden.png',
        path: '/vault/assets/.hidden.png',
        isDirectory: false,
        isFile: true,
        size: 1024,
      },
      {
        name: 'huge.jpg',
        path: '/vault/assets/huge.jpg',
        isDirectory: false,
        isFile: true,
        size: 9 * 1024 * 1024,
      },
      {
        name: 'small.jpg',
        path: '/vault/assets/small.jpg',
        isDirectory: false,
        isFile: true,
        size: 1024,
      },
    ]);

    const attachments = await loadMentionedFolderImageAttachments([
      { path: 'assets', title: 'assets/', kind: 'folder' },
    ]);

    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.name).toBe('small.jpg');
  });

  it('checks file size with stat when folder entries do not include size', async () => {
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'cover.png',
        path: '/vault/assets/cover.png',
        isDirectory: false,
        isFile: true,
      },
    ]);
    mocks.storage.stat.mockResolvedValue({
      name: 'cover.png',
      path: '/vault/assets/cover.png',
      isDirectory: false,
      isFile: true,
      size: 4096,
    });

    const attachments = await loadMentionedFolderImageAttachments([
      { path: 'assets', title: 'assets/', kind: 'folder' },
    ]);

    expect(mocks.storage.stat).toHaveBeenCalledWith('/vault/assets/cover.png');
    expect(attachments[0]).toMatchObject({
      path: '/vault/assets/cover.png',
      name: 'cover.png',
      size: 4096,
    });
  });

  it('does not attach images for note mentions', async () => {
    const attachments = await loadMentionedFolderImageAttachments([
      { path: 'docs/a.md', title: 'A', kind: 'note' },
    ]);

    expect(attachments).toEqual([]);
    expect(mocks.storage.listDir).not.toHaveBeenCalled();
  });

  it('treats file tree folder matches as folder mentions when kind is absent', async () => {
    mocks.notesState.rootFolder = {
      children: [
        {
          id: 'assets',
          name: 'assets',
          path: 'assets',
          isFolder: true,
          expanded: true,
          children: [],
        },
      ],
    };
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'cover.png',
        path: '/vault/assets/cover.png',
        isDirectory: false,
        isFile: true,
        size: 2048,
      },
    ]);

    const attachments = await loadMentionedFolderImageAttachments([
      { path: 'assets', title: 'assets/' },
    ]);

    expect(attachments[0]?.name).toBe('cover.png');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { collectImageReferenceContentUpdates } from './imageReferenceRewrite';

const hoisted = vi.hoisted(() => ({
  exists: vi.fn(async () => false),
  readFile: vi.fn(async () => ''),
  resolveCandidates: vi.fn(async (
    notesPath: string,
    source: string,
    notePath: string,
  ) => {
    const noteDir = notePath.includes('/') ? notePath.slice(0, notePath.lastIndexOf('/')) : '';
    const normalized = decodeURIComponent(source).replace(/^\.\//, '');
    return [`${notesPath}/${noteDir ? `${noteDir}/` : ''}${normalized}`];
  }),
}));

vi.mock('@/lib/storage/adapter', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/storage/adapter')>(),
  getStorageAdapter: () => ({
    exists: hoisted.exists,
    readFile: hoisted.readFile,
  }),
}));

vi.mock('@/lib/assets/core/paths', () => ({
  resolveNotesRootAssetPathCandidates: hoisted.resolveCandidates,
}));

vi.mock('./notesRootPathContainment', async (importOriginal) => ({
  ...await importOriginal<typeof import('./notesRootPathContainment')>(),
  resolveNotesRootRelativeFullPath: vi.fn(async (notesPath: string, path: string) => ({
    fullPath: `${notesPath}/${path}`,
    relativePath: path,
  })),
}));

describe('collectImageReferenceContentUpdates', () => {
  it('rewrites every body reference and the note cover', async () => {
    const content = [
      '---',
      'vlaina_cover: "assets/old.png"',
      '---',
      '',
      '![first](assets/old.png)',
      '<img src="assets/old.png">',
      '![other](assets/other.png)',
    ].join('\n');
    const rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true as const,
      expanded: true,
      children: [
        { id: 'docs/alpha.md', name: 'alpha', path: 'docs/alpha.md', isFolder: false as const },
      ],
    };

    const updates = await collectImageReferenceContentUpdates({
      notesPath: '/notesRoot',
      rootFolder,
      oldImagePath: 'docs/assets/old.png',
      newImagePath: 'docs/assets/new.png',
      currentNote: { path: 'docs/alpha.md', content },
      noteContentsCache: new Map(),
      noteMetadata: {
        version: 2,
        notes: {
          'docs/alpha.md': { cover: { assetPath: 'assets/old.png', positionX: 30 } },
        },
      },
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.content).toContain('vlaina_cover: "assets/new.png" x=30');
    expect(updates[0]?.content.match(/assets\/new\.png/g)).toHaveLength(3);
    expect(updates[0]?.content).toContain('assets/other.png');
    expect(updates[0]?.content).not.toContain('assets/old.png');
  });
});

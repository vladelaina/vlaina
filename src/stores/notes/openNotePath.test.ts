import { describe, expect, it, vi } from 'vitest';
import { openStoredNotePath } from './openNotePath';

describe('openStoredNotePath', () => {
  it('routes cloud paths through openNote', async () => {
    const openNote = vi.fn(async () => undefined);
    const openNoteByAbsolutePath = vi.fn(async () => undefined);

    await openStoredNotePath('cloud://12/main/docs/a.md', {
      openNote,
      openNoteByAbsolutePath,
    });

    expect(openNote).toHaveBeenCalledWith('cloud://12/main/docs/a.md', undefined);
    expect(openNoteByAbsolutePath).not.toHaveBeenCalled();
  });

  it('routes absolute filesystem paths through openNoteByAbsolutePath', async () => {
    const openNote = vi.fn(async () => undefined);
    const openNoteByAbsolutePath = vi.fn(async () => undefined);

    await openStoredNotePath('C:\\vault\\docs\\a.md', {
      openNote,
      openNoteByAbsolutePath,
    });

    expect(openNote).not.toHaveBeenCalled();
    expect(openNoteByAbsolutePath).toHaveBeenCalledWith('C:\\vault\\docs\\a.md', undefined);
  });

  it('routes relative vault paths through openNote', async () => {
    const openNote = vi.fn(async () => undefined);
    const openNoteByAbsolutePath = vi.fn(async () => undefined);

    await openStoredNotePath('docs/a.md', {
      openNote,
      openNoteByAbsolutePath,
    });

    expect(openNote).toHaveBeenCalledWith('docs/a.md', undefined);
    expect(openNoteByAbsolutePath).not.toHaveBeenCalled();
  });

  it('forwards the open-in-new-tab option to the selected handler', async () => {
    const openNote = vi.fn(async () => undefined);
    const openNoteByAbsolutePath = vi.fn(async () => undefined);

    await openStoredNotePath('/vault/docs/a.md', {
      openNote,
      openNoteByAbsolutePath,
    }, {
      openInNewTab: true,
    });

    expect(openNote).not.toHaveBeenCalled();
    expect(openNoteByAbsolutePath).toHaveBeenCalledWith('/vault/docs/a.md', true);
  });
});

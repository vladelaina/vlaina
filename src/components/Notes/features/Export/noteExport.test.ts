import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportNote } from './noteExport';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  renderNoteExportElement: vi.fn(),
  renderNoteExportHtml: vi.fn(),
  resolveExportMarkdownAssetSources: vi.fn(),
  saveDialog: vi.fn(),
  toPng: vi.fn(),
  writeDesktopBinaryFile: vi.fn(),
}));

vi.mock('html-to-image', () => ({
  toPng: mocks.toPng,
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => null,
}));

vi.mock('@/lib/storage/dialog', () => ({
  saveDialog: mocks.saveDialog,
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: mocks.addToast,
    }),
  },
}));

vi.mock('@/lib/notes/displayName', () => ({
  getNoteTitleFromPath: () => 'Fallback',
}));

vi.mock('@/lib/desktop/fs', () => ({
  writeDesktopBinaryFile: mocks.writeDesktopBinaryFile,
}));

vi.mock('./noteExportDocx', () => ({
  createDocxExportBytes: vi.fn(),
}));

vi.mock('./noteExportHtml', () => ({
  renderNoteExportElement: mocks.renderNoteExportElement,
  renderNoteExportHtml: mocks.renderNoteExportHtml,
}));

vi.mock('./noteExportMarkdown', () => ({
  resolveExportMarkdownAssetSources: mocks.resolveExportMarkdownAssetSources,
}));

describe('exportNote', () => {
  beforeEach(() => {
    mocks.addToast.mockReset();
    mocks.renderNoteExportElement.mockReset();
    mocks.renderNoteExportHtml.mockReset();
    mocks.resolveExportMarkdownAssetSources.mockReset();
    mocks.saveDialog.mockReset();
    mocks.toPng.mockReset();
    mocks.writeDesktopBinaryFile.mockReset();

    mocks.saveDialog.mockResolvedValue('/tmp/Exported.html');
    mocks.resolveExportMarkdownAssetSources.mockImplementation(async (markdown: string) => markdown);
    mocks.renderNoteExportElement.mockImplementation(async () => ({
      element: document.createElement('article'),
      cleanup: vi.fn(),
    }));
    mocks.renderNoteExportHtml.mockImplementation(async (markdown: string) => `<html>${markdown}</html>`);
    mocks.toPng.mockResolvedValue('data:image/png;base64,cG5n');
  });

  it('strips vlaina-managed frontmatter before exporting', async () => {
    await exportNote({
      format: 'html',
      markdown: [
        '---',
        'vlaina_cover: "@biva/1"',
        'vlaina_updated: "2026-04-22T13:18:03.350Z"',
        '---',
        '',
        '# Exported',
      ].join('\n'),
      notePath: 'Exported.md',
      notesPath: '/vault',
      title: 'Exported',
    });

    expect(mocks.resolveExportMarkdownAssetSources).toHaveBeenCalledWith(
      '# Exported',
      '/vault',
      'Exported.md',
    );
    expect(mocks.renderNoteExportHtml).toHaveBeenCalledWith('# Exported', 'Exported');

    const [, bytes] = mocks.writeDesktopBinaryFile.mock.calls[0] ?? [];
    const writtenHtml = new TextDecoder().decode(bytes);
    expect(writtenHtml).not.toContain('vlaina_cover');
    expect(writtenHtml).not.toContain('vlaina_updated');
    expect(writtenHtml).toContain('# Exported');
  });

  it('rejects oversized markdown before rendering export output', async () => {
    await expect(exportNote({
      format: 'html',
      markdown: 'x'.repeat(2 * 1024 * 1024 + 1),
      notePath: 'Huge.md',
      notesPath: '/vault',
      title: 'Huge',
    })).rejects.toThrow('Note is too large to export safely.');

    expect(mocks.resolveExportMarkdownAssetSources).not.toHaveBeenCalled();
    expect(mocks.renderNoteExportHtml).not.toHaveBeenCalled();
    expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
  });

  it('exports PNG without rendering an intermediate HTML document', async () => {
    mocks.saveDialog.mockResolvedValue('/tmp/Exported.png');

    await exportNote({
      format: 'png',
      markdown: '# Exported',
      notePath: 'Exported.md',
      notesPath: '/vault',
      title: 'Exported',
    });

    expect(mocks.renderNoteExportHtml).not.toHaveBeenCalled();
    expect(mocks.renderNoteExportElement).toHaveBeenCalledWith('# Exported', 'Exported');
    expect(mocks.writeDesktopBinaryFile.mock.calls[0]?.[0]).toBe('/tmp/Exported.png');
    expect(new TextDecoder().decode(mocks.writeDesktopBinaryFile.mock.calls[0]?.[1])).toBe('png');
  });

  it('rejects PNG exports when html-to-image returns a non-PNG data URL', async () => {
    mocks.toPng.mockResolvedValueOnce('data:text/html;base64,PHNjcmlwdD4=');

    await expect(exportNote({
      format: 'png',
      markdown: '# Exported',
      notePath: 'Exported.md',
      notesPath: '/vault',
      title: 'Exported',
    })).rejects.toThrow('Unexpected PNG export MIME type.');

    expect(mocks.saveDialog).not.toHaveBeenCalled();
    expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
    expect(mocks.addToast).not.toHaveBeenCalled();
  });
});

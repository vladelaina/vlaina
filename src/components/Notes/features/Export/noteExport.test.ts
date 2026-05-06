import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportNote } from './noteExport';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  renderNoteExportHtml: vi.fn(),
  resolveExportMarkdownAssetSources: vi.fn(),
  saveDialog: vi.fn(),
  writeDesktopBinaryFile: vi.fn(),
}));

vi.mock('html-to-image', () => ({
  toPng: vi.fn(),
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
  renderNoteExportElement: vi.fn(),
  renderNoteExportHtml: mocks.renderNoteExportHtml,
}));

vi.mock('./noteExportMarkdown', () => ({
  resolveExportMarkdownAssetSources: mocks.resolveExportMarkdownAssetSources,
}));

describe('exportNote', () => {
  beforeEach(() => {
    mocks.addToast.mockReset();
    mocks.renderNoteExportHtml.mockReset();
    mocks.resolveExportMarkdownAssetSources.mockReset();
    mocks.saveDialog.mockReset();
    mocks.writeDesktopBinaryFile.mockReset();

    mocks.saveDialog.mockResolvedValue('/tmp/Exported.html');
    mocks.resolveExportMarkdownAssetSources.mockImplementation(async (markdown: string) => markdown);
    mocks.renderNoteExportHtml.mockImplementation(async (markdown: string) => `<html>${markdown}</html>`);
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
});

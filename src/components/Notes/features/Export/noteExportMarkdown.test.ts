import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveExportMarkdownAssetSources } from './noteExportMarkdown';

const mocks = vi.hoisted(() => ({
  readBinaryFile: vi.fn(),
  resolveExistingVaultAssetPath: vi.fn(),
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => ({
    fs: {
      readBinaryFile: mocks.readBinaryFile,
    },
  }),
}));

vi.mock('@/lib/assets/core/paths', () => ({
  resolveExistingVaultAssetPath: mocks.resolveExistingVaultAssetPath,
}));

describe('resolveExportMarkdownAssetSources', () => {
  beforeEach(() => {
    mocks.readBinaryFile.mockReset();
    mocks.resolveExistingVaultAssetPath.mockReset();
  });

  it('embeds local note images as data URLs for portable exports', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      '![demo](img:demo.png)',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![demo](data:image/png;base64,aGk=)');
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'demo.png',
      'docs/demo.md',
    );
  });
});

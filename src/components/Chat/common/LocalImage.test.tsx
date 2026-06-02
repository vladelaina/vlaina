import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalImage } from './LocalImage';

const mocks = vi.hoisted(() => ({
  getBasePath: vi.fn().mockResolvedValue('/appdata'),
  joinPath: vi.fn(),
  rasterizeSvgDataUrlToPng: vi.fn(),
  readBinaryFile: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    getBasePath: mocks.getBasePath,
    readBinaryFile: mocks.readBinaryFile,
  }),
  joinPath: mocks.joinPath,
}));

vi.mock('./svgRasterize', () => ({
  isSvgDataUrl: (value: string) => value.trim().toLowerCase().startsWith('data:image/svg+xml'),
  rasterizeSvgDataUrlToPng: mocks.rasterizeSvgDataUrlToPng,
}));

describe('LocalImage', () => {
  beforeEach(() => {
    mocks.getBasePath.mockClear();
    mocks.joinPath.mockReset();
    mocks.joinPath.mockImplementation(async (...segments: string[]) => segments.join('/'));
    mocks.rasterizeSvgDataUrlToPng.mockReset();
    mocks.rasterizeSvgDataUrlToPng.mockResolvedValue('data:image/png;base64,RASTER');
    mocks.readBinaryFile.mockReset();
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([60, 115, 118, 103, 62]));
  });

  it('rasterizes inline SVG data before rendering', async () => {
    render(<LocalImage src="data:image/svg+xml;base64,PHN2Zz4=" alt="diagram" />);

    const image = await screen.findByAltText('diagram');
    expect(image).toHaveAttribute('src', 'data:image/png;base64,RASTER');
    expect(mocks.rasterizeSvgDataUrlToPng).toHaveBeenCalledWith('data:image/svg+xml;base64,PHN2Zz4=');
  });

  it('rasterizes stored SVG attachments before rendering', async () => {
    render(<LocalImage src="attachment://diagram.svg" alt="diagram" />);

    const image = await screen.findByAltText('diagram');
    expect(mocks.joinPath).toHaveBeenCalledWith('/appdata', '.vlaina', 'attachments', 'diagram.svg');
    expect(mocks.rasterizeSvgDataUrlToPng).toHaveBeenCalledWith('data:image/svg+xml;base64,PHN2Zz4=');
    expect(image).toHaveAttribute('src', 'data:image/png;base64,RASTER');
  });

  it('shows unavailable state when SVG rasterization fails', async () => {
    mocks.rasterizeSvgDataUrlToPng.mockResolvedValueOnce(null);

    render(<LocalImage src="data:image/svg+xml;base64,PHN2Zz4=" alt="diagram" />);

    await waitFor(() => {
      expect(screen.getByText('Image unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByAltText('diagram')).not.toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalImage } from './LocalImage';

const mocks = vi.hoisted(() => ({
  getBasePath: vi.fn().mockResolvedValue('/appdata'),
  joinPath: vi.fn(),
  rasterizeSvgDataUrlToPng: vi.fn(),
  readBinaryFile: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    getBasePath: mocks.getBasePath,
    readBinaryFile: mocks.readBinaryFile,
    stat: mocks.stat,
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
    mocks.stat.mockReset();
    mocks.stat.mockResolvedValue({
      name: 'diagram.svg',
      path: '/appdata/.vlaina/attachments/diagram.svg',
      isDirectory: false,
      isFile: true,
      size: 5,
    });
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

  it('blocks relative image paths with directories instead of browser-loading them', async () => {
    render(<LocalImage src="images/demo.png" alt="relative" />);

    await waitFor(() => {
      expect(screen.getByText('Image unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByAltText('relative')).not.toBeInTheDocument();
    expect(mocks.getBasePath).not.toHaveBeenCalled();
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('renders safe image protocols directly regardless of case', async () => {
    render(<LocalImage src="HTTPS://example.com/demo.png" alt="remote" />);

    const image = await screen.findByAltText('remote');
    expect(image).toHaveAttribute('src', 'HTTPS://example.com/demo.png');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(mocks.getBasePath).not.toHaveBeenCalled();
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('normalizes case-insensitive inline raster data before rendering', async () => {
    render(<LocalImage src="DATA:IMAGE/WEBP;BASE64,AQI=" alt="inline" />);

    const image = await screen.findByAltText('inline');
    expect(image).toHaveAttribute('src', 'data:image/webp;base64,AQI=');
    expect(mocks.getBasePath).not.toHaveBeenCalled();
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('blocks local-network remote image sources at the component boundary', async () => {
    render(<LocalImage src="http://127.0.0.1:3000/secret.png" alt="local" />);

    await waitFor(() => {
      expect(screen.getByText('Image unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByAltText('local')).not.toBeInTheDocument();
    expect(mocks.getBasePath).not.toHaveBeenCalled();
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('blocks unsupported inline data image sources at the component boundary', async () => {
    render(<LocalImage src="data:text/html;base64,PHNjcmlwdD4=" alt="html" />);

    await waitFor(() => {
      expect(screen.getByText('Image unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByAltText('html')).not.toBeInTheDocument();
    expect(mocks.getBasePath).not.toHaveBeenCalled();
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('keeps bare image filenames mapped to stored attachments', async () => {
    render(<LocalImage src="demo.png" alt="attachment" />);

    const image = await screen.findByAltText('attachment');
    expect(mocks.joinPath).toHaveBeenCalledWith('/appdata', '.vlaina', 'attachments', 'demo.png');
    expect(mocks.readBinaryFile).toHaveBeenCalledWith('/appdata/.vlaina/attachments/demo.png');
    expect(image).toHaveAttribute('src', 'data:image/png;base64,PHN2Zz4=');
  });

  it('shows unavailable state for oversized stored attachments before reading them', async () => {
    mocks.stat.mockResolvedValueOnce({ size: 10 * 1024 * 1024 + 1 });

    render(<LocalImage src="attachment://huge.png" alt="huge" />);

    await waitFor(() => {
      expect(screen.getByText('Image unavailable')).toBeInTheDocument();
    });
    expect(mocks.stat).toHaveBeenCalledWith('/appdata/.vlaina/attachments/huge.png');
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
    expect(screen.queryByAltText('huge')).not.toBeInTheDocument();
  });

  it('shows unavailable state for stored attachments without a stat size before reading them', async () => {
    mocks.stat.mockResolvedValueOnce(null);

    render(<LocalImage src="attachment://missing-size.png" alt="missing" />);

    await waitFor(() => {
      expect(screen.getByText('Image unavailable')).toBeInTheDocument();
    });
    expect(mocks.stat).toHaveBeenCalledWith('/appdata/.vlaina/attachments/missing-size.png');
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
    expect(screen.queryByAltText('missing')).not.toBeInTheDocument();
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

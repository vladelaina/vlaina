import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppIcon, loadAppIconImageSrc } from './AppIcon';

const hoisted = vi.hoisted(() => ({
  loadImageAsBlob: vi.fn(),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageAsBlob: hoisted.loadImageAsBlob,
}));

vi.mock('@/lib/storage/paths', () => ({
  getPaths: () => Promise.resolve({ app: '/app/.vlaina/app' }),
}));

vi.mock('@/lib/storage/adapter', () => ({
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
}));

describe('AppIcon image loading', () => {
  beforeEach(() => {
    hoisted.loadImageAsBlob.mockReset();
    hoisted.loadImageAsBlob.mockResolvedValue('blob:icon');
  });

  it('loads global icon assets from the app icon directory', async () => {
    await expect(loadAppIconImageSrc('img:/app/.vlaina/app/assets/icons/demo.png')).resolves.toBe('blob:icon');
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledWith('/app/.vlaina/app/assets/icons/demo.png');
  });

  it('renders legacy global image-scheme icons through the app icon loader', async () => {
    render(createElement(AppIcon, { icon: 'img:/app/.vlaina/app/assets/icons/demo.png' }));

    const image = await screen.findByRole('img');
    expect(image).toHaveAttribute('src', 'blob:icon');
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledWith('/app/.vlaina/app/assets/icons/demo.png');
  });

  it('loads global icon assets with a case-insensitive image scheme', async () => {
    await expect(loadAppIconImageSrc('IMG:/app/.vlaina/app/assets/icons/demo.png')).resolves.toBe('blob:icon');
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledWith('/app/.vlaina/app/assets/icons/demo.png');
  });

  it('loads global icon assets without treating query params as part of the filename', async () => {
    await expect(loadAppIconImageSrc('img:/app/.vlaina/app/assets/icons/demo.png?cache=1#preview')).resolves.toBe('blob:icon');
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledWith('/app/.vlaina/app/assets/icons/demo.png');
  });

  it('rejects absolute and traversing note-controlled icon paths', async () => {
    await expect(loadAppIconImageSrc('img:/etc/passwd')).resolves.toBeNull();
    await expect(loadAppIconImageSrc('img:/app/.vlaina/app/assets/icons/../../secret.png')).resolves.toBeNull();
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });
});

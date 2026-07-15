import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateToImageFileReference } from './imageFileReferenceNavigation';

describe('navigateToImageFileReference', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  it('opens another note and scrolls to the referenced body image', async () => {
    const image = document.createElement('div');
    image.dataset.src = 'assets/cover.webp';
    image.scrollIntoView = vi.fn();
    image.focus = vi.fn();
    const openNote = vi.fn(async () => {
      document.body.appendChild(image);
    });

    await expect(navigateToImageFileReference({
      path: 'docs/alpha.md',
      name: 'alpha',
      kind: 'body',
      source: 'assets/cover.webp',
      offset: 12,
    }, 'docs/current.md', openNote)).resolves.toBe(true);

    expect(openNote).toHaveBeenCalledWith('docs/alpha.md');
    expect(image.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' });
  });

  it('scrolls cover references to the note cover region', async () => {
    const cover = document.createElement('div');
    cover.dataset.noteCoverRegion = 'true';
    cover.scrollIntoView = vi.fn();
    cover.focus = vi.fn();
    document.body.appendChild(cover);
    const openNote = vi.fn();

    await expect(navigateToImageFileReference({
      path: 'docs/alpha.md',
      name: 'alpha',
      kind: 'cover',
    }, 'docs/alpha.md', openNote)).resolves.toBe(true);

    expect(openNote).not.toHaveBeenCalled();
    expect(cover.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' });
  });
});

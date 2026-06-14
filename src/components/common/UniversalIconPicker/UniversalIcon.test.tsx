import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UniversalIcon } from './UniversalIcon';

describe('UniversalIcon', () => {
  it('does not render arbitrary text icon values', () => {
    const { container } = render(<UniversalIcon icon="not-a-standard-logo" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('does not render unknown symbol icon values as text', () => {
    const { container } = render(<UniversalIcon icon="icon:notRegistered:#ffcc00" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('reuses a loaded image icon source immediately after remounting', async () => {
    const imageLoader = vi.fn().mockResolvedValue('blob:logo');

    const first = render(<UniversalIcon icon="assets/icons/logo.png" imageLoader={imageLoader} />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'icon' })).toHaveAttribute('src', 'blob:logo');
    });

    first.unmount();

    render(<UniversalIcon icon="assets/icons/logo.png" imageLoader={imageLoader} />);

    expect(screen.getByRole('img', { name: 'icon' })).toHaveAttribute('src', 'blob:logo');
    expect(imageLoader).toHaveBeenCalledTimes(1);
  });

  it('does not render legacy image-scheme icon values', () => {
    const imageLoader = vi.fn().mockResolvedValue('blob:logo');

    const { container } = render(<UniversalIcon icon="IMG:/app/.vlaina/assets/icons/logo.png" imageLoader={imageLoader} />);

    expect(container).toBeEmptyDOMElement();
    expect(imageLoader).not.toHaveBeenCalled();
  });

  it('loads legacy image-scheme icon values when explicitly allowed', async () => {
    const imageLoader = vi.fn().mockResolvedValue('blob:logo');

    render(
      <UniversalIcon
        icon="IMG:/app/.vlaina/assets/icons/logo.png"
        imageLoader={imageLoader}
        allowLegacyImageScheme
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'icon' })).toHaveAttribute('src', 'blob:logo');
    });
    expect(imageLoader).toHaveBeenCalledWith('IMG:/app/.vlaina/assets/icons/logo.png');
  });

  it('loads plain image icon paths', async () => {
    const imageLoader = vi.fn().mockResolvedValue('blob:logo');

    render(<UniversalIcon icon="assets/icons/logo.png" imageLoader={imageLoader} />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'icon' })).toHaveAttribute('src', 'blob:logo');
    });

    expect(imageLoader).toHaveBeenCalledWith('assets/icons/logo.png');
  });

  it('hides an image icon when the resolved image source fails to load', async () => {
    const imageLoader = vi.fn().mockResolvedValue('blob:missing');

    render(<UniversalIcon icon="assets/icons/missing.png" imageLoader={imageLoader} />);

    const image = await screen.findByRole('img', { name: 'icon' });
    expect(image).toHaveAttribute('src', 'blob:missing');

    fireEvent.error(image);

    expect(screen.queryByRole('img', { name: 'icon' })).not.toBeInTheDocument();
  });

  it('tries rendering again when an image icon changes after a load failure', async () => {
    const imageLoader = vi
      .fn()
      .mockResolvedValueOnce('blob:missing')
      .mockResolvedValueOnce('blob:next');

    const { rerender } = render(<UniversalIcon icon="assets/icons/missing.png" imageLoader={imageLoader} />);

    fireEvent.error(await screen.findByRole('img', { name: 'icon' }));
    expect(screen.queryByRole('img', { name: 'icon' })).not.toBeInTheDocument();

    rerender(<UniversalIcon icon="assets/icons/next.png" imageLoader={imageLoader} />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'icon' })).toHaveAttribute('src', 'blob:next');
    });
  });

  it('bounds the per-loader image source cache', async () => {
    const imageLoader = vi.fn(async (src: string) => `blob:${src}`);
    const icons = Array.from({ length: 513 }, (_, index) => `assets/icons/${index}.png`);

    const { unmount } = render(
      <div>
        {icons.map((icon) => (
          <UniversalIcon key={icon} icon={icon} imageLoader={imageLoader} />
        ))}
      </div>
    );

    await waitFor(() => {
      expect(imageLoader).toHaveBeenCalledTimes(513);
    });

    unmount();
    render(<UniversalIcon icon={icons[0]} imageLoader={imageLoader} />);

    await waitFor(() => {
      expect(imageLoader).toHaveBeenCalledTimes(514);
    });
  });
});

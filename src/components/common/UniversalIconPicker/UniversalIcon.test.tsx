import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UniversalIcon } from './UniversalIcon';

describe('UniversalIcon', () => {
  it('reuses a loaded image icon source immediately after remounting', async () => {
    const imageLoader = vi.fn().mockResolvedValue('blob:logo');

    const first = render(<UniversalIcon icon="img:/app/.vlaina/assets/icons/logo.png" imageLoader={imageLoader} />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'icon' })).toHaveAttribute('src', 'blob:logo');
    });

    first.unmount();

    render(<UniversalIcon icon="img:/app/.vlaina/assets/icons/logo.png" imageLoader={imageLoader} />);

    expect(screen.getByRole('img', { name: 'icon' })).toHaveAttribute('src', 'blob:logo');
    expect(imageLoader).toHaveBeenCalledTimes(1);
  });

  it('loads image icons with a case-insensitive image scheme', async () => {
    const imageLoader = vi.fn().mockResolvedValue('blob:logo');

    render(<UniversalIcon icon="IMG:/app/.vlaina/assets/icons/logo.png" imageLoader={imageLoader} />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'icon' })).toHaveAttribute('src', 'blob:logo');
    });

    expect(imageLoader).toHaveBeenCalledWith('IMG:/app/.vlaina/assets/icons/logo.png');
  });

  it('hides an image icon when the resolved image source fails to load', async () => {
    const imageLoader = vi.fn().mockResolvedValue('blob:missing');

    render(<UniversalIcon icon="img:/app/.vlaina/assets/icons/missing.png" imageLoader={imageLoader} />);

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

    const { rerender } = render(<UniversalIcon icon="img:/app/.vlaina/assets/icons/missing.png" imageLoader={imageLoader} />);

    fireEvent.error(await screen.findByRole('img', { name: 'icon' }));
    expect(screen.queryByRole('img', { name: 'icon' })).not.toBeInTheDocument();

    rerender(<UniversalIcon icon="img:/app/.vlaina/assets/icons/next.png" imageLoader={imageLoader} />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'icon' })).toHaveAttribute('src', 'blob:next');
    });
  });
});

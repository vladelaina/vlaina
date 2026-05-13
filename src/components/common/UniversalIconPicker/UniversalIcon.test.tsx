import { render, screen, waitFor } from '@testing-library/react';
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
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccountAvatarImage } from './AccountAvatarImage';

describe('AccountAvatarImage', () => {
  it('uses the fallback logo when no avatar source is available', () => {
    render(<AccountAvatarImage src={null} fallbackSrc="/logo.png?v=20260327" alt="vlaina" />);

    expect(screen.getByRole('img', { name: 'vlaina' })).toHaveAttribute('src', '/logo.png?v=20260327');
  });

  it('falls back to the logo when the avatar image fails to load', () => {
    render(
      <AccountAvatarImage
        src="https://lh3.googleusercontent.com/avatar"
        fallbackSrc="/logo.png?v=20260327"
        alt="alice"
      />
    );

    const image = screen.getByRole('img', { name: 'alice' });
    expect(image).toHaveAttribute('src', 'https://lh3.googleusercontent.com/avatar');

    fireEvent.error(image);

    expect(image).toHaveAttribute('src', '/logo.png?v=20260327');
  });

  it('tries a new avatar source after a previous source failed', () => {
    const { rerender } = render(
      <AccountAvatarImage src="https://example.com/stale.png" fallbackSrc="/logo.png?v=20260327" alt="alice" />
    );

    fireEvent.error(screen.getByRole('img', { name: 'alice' }));
    expect(screen.getByRole('img', { name: 'alice' })).toHaveAttribute('src', '/logo.png?v=20260327');

    rerender(<AccountAvatarImage src="data:image/png;base64,local" fallbackSrc="/logo.png?v=20260327" alt="alice" />);

    expect(screen.getByRole('img', { name: 'alice' })).toHaveAttribute('src', 'data:image/png;base64,local');
  });
});

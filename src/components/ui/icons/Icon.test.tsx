import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './index';

describe('Icon', () => {
  it('renders decorative icons as hidden from assistive tech by default', () => {
    const { container } = render(<Icon name="common.check" size="md" />);
    const icon = container.querySelector('svg');

    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('focusable', 'false');
    expect(icon).not.toHaveAttribute('role');
    expect(icon).toHaveStyle({ width: '20px', height: '20px', lineHeight: '1' });
    expect(icon?.classList.contains('align-middle')).toBe(true);
  });

  it('uses an image role when an accessible label is provided', () => {
    render(<Icon name="common.info" aria-label="Information" />);
    const icon = screen.getByRole('img', { name: 'Information' });

    expect(icon).toHaveAttribute('focusable', 'false');
    expect(icon).not.toHaveAttribute('aria-hidden');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountLoginDialog } from './AccountLoginDialog';

vi.mock('@/stores/accountSession', () => ({
  useAccountSessionStore: () => ({
    isConnecting: false,
    error: null,
    signIn: vi.fn(),
    requestEmailCode: vi.fn().mockResolvedValue(true),
    verifyEmailCode: vi.fn().mockResolvedValue(true),
    cancelConnect: vi.fn(),
    clearError: vi.fn(),
  }),
}));

describe('AccountLoginDialog', () => {
  it('keeps the dialog open when clicking outside the sign-in panel', () => {
    const onOpenChange = vi.fn();

    render(<AccountLoginDialog open onOpenChange={onOpenChange} />);

    fireEvent.pointerDown(document.body, { button: 0 });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

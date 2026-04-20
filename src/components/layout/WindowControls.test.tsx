import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WindowControls } from './WindowControls';

const mocks = vi.hoisted(() => ({
  windowState: {
    minimize: vi.fn().mockResolvedValue(undefined),
    toggleMaximize: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/desktop/window', () => ({
  desktopWindow: mocks.windowState,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span>{name}</span>,
}));

describe('WindowControls', () => {
  beforeEach(() => {
    mocks.windowState.minimize.mockClear();
    mocks.windowState.toggleMaximize.mockClear();
    mocks.windowState.close.mockClear();
  });

  it('dispatches minimize, maximize and close through the electron window api', () => {
    render(<WindowControls />);

    fireEvent.click(screen.getByText('window.minimize'));
    fireEvent.click(screen.getByText('window.maximize'));
    fireEvent.click(screen.getByText('window.close'));

    expect(mocks.windowState.minimize).toHaveBeenCalledTimes(1);
    expect(mocks.windowState.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(mocks.windowState.close).toHaveBeenCalledTimes(1);
  });

  it('omits the maximize button in minimal mode', () => {
    render(<WindowControls minimal />);

    expect(screen.getByText('window.minimize')).toBeInTheDocument();
    expect(screen.queryByText('window.maximize')).toBeNull();
    expect(screen.getByText('window.close')).toBeInTheDocument();
  });
});

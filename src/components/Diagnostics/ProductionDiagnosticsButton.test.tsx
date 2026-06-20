import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeTextToClipboard: vi.fn(),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock('@/lib/clipboard', () => ({
  writeTextToClipboard: (...args: unknown[]) => mocks.writeTextToClipboard(...args),
}));

import { ProductionDiagnosticsButton } from './ProductionDiagnosticsButton';

describe('ProductionDiagnosticsButton', () => {
  beforeEach(() => {
    mocks.writeTextToClipboard.mockReset();
  });

  it('copies injected log text from the button entry point', async () => {
    mocks.writeTextToClipboard.mockResolvedValue(true);
    const getLogText = vi.fn(() => 'custom logs');

    render(<ProductionDiagnosticsButton forceVisible getLogText={getLogText} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy diagnostic logs' }));

    await waitFor(() => {
      expect(mocks.writeTextToClipboard).toHaveBeenCalledWith('custom logs');
    });
    expect(getLogText).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('icon-common.check')).toBeInTheDocument();
  });

  it('does not show copied feedback when clipboard write fails', async () => {
    mocks.writeTextToClipboard.mockResolvedValue(false);

    render(<ProductionDiagnosticsButton forceVisible getLogText={() => 'custom logs'} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy diagnostic logs' }));

    await waitFor(() => {
      expect(mocks.writeTextToClipboard).toHaveBeenCalledWith('custom logs');
    });
    expect(screen.getByTestId('icon-common.copy')).toBeInTheDocument();
  });
});

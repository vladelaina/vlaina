import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComputerCommandApprovalSettings } from './ComputerCommandApprovalSettings';

const desktopMock = vi.hoisted(() => ({
  available: true,
  listApprovals: vi.fn(),
  revokeApproval: vi.fn(),
  clearApprovals: vi.fn(),
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => desktopMock.available
    ? { computer: desktopMock }
    : null,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('ComputerCommandApprovalSettings', () => {
  beforeEach(() => {
    desktopMock.available = true;
    desktopMock.listApprovals.mockReset().mockResolvedValue([
      { id: 'a'.repeat(64), command: 'git status --short', cwd: '/tmp/project', createdAt: 2 },
      { id: 'b'.repeat(64), command: 'pnpm install', cwd: '/tmp/project', createdAt: 1 },
    ]);
    desktopMock.revokeApproval.mockReset().mockResolvedValue(true);
    desktopMock.clearApprovals.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it('lists, revokes, and clears exact command approvals', async () => {
    render(<ComputerCommandApprovalSettings />);

    expect(await screen.findByText('git status --short')).toBeInTheDocument();
    expect(screen.getByText('pnpm install')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.remove: git status --short' }));
    await waitFor(() => {
      expect(desktopMock.revokeApproval).toHaveBeenCalledWith('a'.repeat(64));
      expect(screen.queryByText('git status --short')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'settings.ai.clearComputerPermissions' }));
    await waitFor(() => {
      expect(desktopMock.clearApprovals).toHaveBeenCalledTimes(1);
      expect(screen.getByText('settings.ai.computerPermissionsEmpty')).toBeInTheDocument();
    });
  });

  it('stays hidden outside the desktop runtime', () => {
    desktopMock.available = false;
    const { container } = render(<ComputerCommandApprovalSettings />);

    expect(container).toBeEmptyDOMElement();
    expect(desktopMock.listApprovals).not.toHaveBeenCalled();
  });
});

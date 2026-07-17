import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DesktopApi } from '@/lib/electron/bridge';
import {
  publishComputerCommandApproval,
  resetComputerCommandApprovalsForTests,
} from '@/lib/ai/computerUse/approvalState';
import { ComputerCommandApprovalNotice } from './ComputerCommandApprovalNotice';

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('ComputerCommandApprovalNotice', () => {
  const respondToApproval = vi.fn(async () => true);

  beforeEach(() => {
    act(() => resetComputerCommandApprovalsForTests());
    respondToApproval.mockClear();
    (window as Window & { vlainaDesktop?: DesktopApi }).vlainaDesktop = {
      platform: 'electron',
      computer: { respondToApproval },
    } as unknown as DesktopApi;
  });

  afterEach(() => {
    act(() => resetComputerCommandApprovalsForTests());
    delete (window as Window & { vlainaDesktop?: DesktopApi }).vlainaDesktop;
  });

  it('submits an exact persistent approval choice to the desktop bridge', async () => {
    act(() => {
      publishComputerCommandApproval('approval-1', {
        command: 'uname -a',
        cwd: '/tmp/project',
        purpose: 'Inspect the system',
        timeoutSeconds: 600,
        risk: 'standard',
        canAlwaysAllow: true,
      });
    });
    render(<ComputerCommandApprovalNotice />);

    const alwaysRunButton = screen.getByRole('button', { name: 'chat.computerUse.alwaysRun' });
    expect(fireEvent.mouseDown(alwaysRunButton)).toBe(false);

    await act(async () => {
      fireEvent.click(alwaysRunButton);
    });

    await waitFor(() => {
      expect(respondToApproval).toHaveBeenCalledWith('approval-1', 'always');
      expect(screen.queryByLabelText('chat.computerUse')).not.toBeInTheDocument();
    });
  });

  it('disables persistent approval for commands rejected by the main-process policy', () => {
    act(() => {
      publishComputerCommandApproval('approval-2', {
        command: 'pnpm install',
        cwd: '/tmp/project',
        purpose: 'Install dependencies',
        timeoutSeconds: 600,
        risk: 'elevated',
        canAlwaysAllow: false,
      });
    });
    render(<ComputerCommandApprovalNotice />);

    expect(screen.getByRole('button', { name: 'chat.computerUse.alwaysRun' })).toBeDisabled();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText('pnpm install')).not.toBeInTheDocument();
    expect(screen.queryByText('/tmp/project')).not.toBeInTheDocument();
  });

  it('advances directly to the next queued approval', async () => {
    act(() => {
      publishComputerCommandApproval('approval-first', {
        command: 'uname -a',
        cwd: '/tmp/project',
        purpose: 'Inspect the system',
        timeoutSeconds: 600,
        risk: 'standard',
        canAlwaysAllow: true,
      });
      publishComputerCommandApproval('approval-second', {
        command: 'df -h',
        cwd: '/tmp/project',
        purpose: 'Inspect disk usage',
        timeoutSeconds: 600,
        risk: 'standard',
        canAlwaysAllow: true,
      });
    });
    render(<ComputerCommandApprovalNotice />);

    fireEvent.click(screen.getByRole('button', { name: 'chat.computerUse.runOnce' }));

    await waitFor(() => {
      expect(respondToApproval).toHaveBeenCalledWith('approval-first', 'run_once');
      expect(screen.getByRole('button', { name: 'chat.computerUse.runOnce' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    await waitFor(() => {
      expect(respondToApproval).toHaveBeenLastCalledWith('approval-second', 'cancel');
      expect(screen.queryByLabelText('chat.computerUse')).not.toBeInTheDocument();
    });
  });
});

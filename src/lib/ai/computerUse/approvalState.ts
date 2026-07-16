import { useSyncExternalStore } from 'react';
import { getElectronBridge } from '@/lib/electron/bridge';

export interface ComputerCommandApprovalRequest {
  id: string;
  command: string;
  cwd: string;
  purpose: string;
  timeoutSeconds: number;
  risk: 'standard' | 'elevated';
  canAlwaysAllow: boolean;
}

export type ComputerCommandApprovalDecision = 'run_once' | 'always' | 'cancel';

let pending: ComputerCommandApprovalRequest[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function publishComputerCommandApproval(
  requestId: string,
  event: Omit<ComputerCommandApprovalRequest, 'id'>,
) {
  const request = { id: requestId, ...event };
  pending = [...pending.filter((item) => item.id !== requestId), request];
  emit();
}

export function clearComputerCommandApproval(requestId: string) {
  const next = pending.filter((item) => item.id !== requestId);
  if (next.length === pending.length) return;
  pending = next;
  emit();
}

export function usePendingComputerCommandApprovals(): readonly ComputerCommandApprovalRequest[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pending,
    () => pending,
  );
}

export function getPendingComputerCommandApprovalsSnapshot(): readonly ComputerCommandApprovalRequest[] {
  return pending;
}

export async function respondToComputerCommandApproval(
  requestId: string,
  decision: ComputerCommandApprovalDecision,
): Promise<boolean> {
  const accepted = await getElectronBridge()?.computer?.respondToApproval(requestId, decision) ?? false;
  if (accepted) clearComputerCommandApproval(requestId);
  return accepted;
}

export function resetComputerCommandApprovalsForTests() {
  pending = [];
  emit();
}

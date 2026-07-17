import {
  getElectronBridge,
  type ElectronGitApi,
  type ElectronGitChange,
  type ElectronGitCommit,
  type ElectronGitStatus,
} from '@/lib/electron/bridge';

export type GitBridge = ElectronGitApi;
export type GitChange = ElectronGitChange;
export type GitHistoryItem = ElectronGitCommit;
export type GitStatus = ElectronGitStatus;

export type GitPanelTab = 'changes' | 'history';
export type GitOperation = 'commit' | 'pull' | 'push';
export type GitChangeKind =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'conflicted';

export function getGitBridge(): GitBridge | null {
  return getElectronBridge()?.git ?? null;
}

export function getGitChangeKind(change: GitChange): GitChangeKind {
  const status = change.status.toLowerCase();
  if (status === 'added' || status === 'modified' || status === 'deleted' ||
      status === 'renamed' || status === 'copied' || status === 'untracked' ||
      status === 'conflicted') {
    return status;
  }

  const code = `${change.indexStatus}${change.workTreeStatus}`;
  if (code.includes('U') || code === 'AA' || code === 'DD') return 'conflicted';
  if (code.includes('?')) return 'untracked';
  if (code.includes('R')) return 'renamed';
  if (code.includes('C')) return 'copied';
  if (code.includes('A')) return 'added';
  if (code.includes('D')) return 'deleted';
  return 'modified';
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function createLocalDateTimeValue(date = new Date()): string {
  return [
    date.getFullYear(),
    '-',
    padDatePart(date.getMonth() + 1),
    '-',
    padDatePart(date.getDate()),
    ' ',
    padDatePart(date.getHours()),
    ':',
    padDatePart(date.getMinutes()),
    ':',
    padDatePart(date.getSeconds()),
  ].join('');
}

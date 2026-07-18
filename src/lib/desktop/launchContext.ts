export type WindowLaunchViewMode = 'notes' | 'chat' | 'whiteboard' | 'graph' | 'lab';

export interface WindowLaunchContext {
  isNewWindow: boolean;
  notesRootPath: string | null;
  notePath: string | null;
  folderPath: string | null;
  chatSessionId: string | null;
  viewMode: WindowLaunchViewMode | null;
}

interface WindowLaunchTarget {
  notesRootPath?: string | null;
  notePath?: string | null;
  folderPath?: string | null;
  chatSessionId?: string | null;
  viewMode?: WindowLaunchViewMode | null;
}

function normalizeLaunchValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeLaunchViewMode(value: string | null | undefined): WindowLaunchViewMode | null {
  if (value === 'notes' || value === 'chat') {
    return value;
  }

  if (value === 'whiteboard' || value === 'graph' || (import.meta.env.DEV && value === 'lab')) {
    return value;
  }

  return null;
}

export function readWindowLaunchContext(search: string = window.location.search): WindowLaunchContext {
  const params = new URLSearchParams(search);

  return {
    isNewWindow: params.get('newWindow') === 'true',
    notesRootPath: normalizeLaunchValue(params.get('notesRootPath')),
    notePath: normalizeLaunchValue(params.get('notePath')),
    folderPath: normalizeLaunchValue(params.get('folderPath')),
    chatSessionId: normalizeLaunchValue(params.get('chatSessionId')),
    viewMode: normalizeLaunchViewMode(params.get('viewMode')),
  };
}

export function buildWindowLaunchSearch(target: WindowLaunchTarget = {}) {
  const params = new URLSearchParams();
  params.set('newWindow', 'true');

  const notesRootPath = normalizeLaunchValue(target.notesRootPath);
  if (notesRootPath) {
    params.set('notesRootPath', notesRootPath);
  }

  const notePath = normalizeLaunchValue(target.notePath);
  if (notePath) {
    params.set('notePath', notePath);
  }

  const folderPath = normalizeLaunchValue(target.folderPath);
  if (folderPath) {
    params.set('folderPath', folderPath);
  }

  const chatSessionId = normalizeLaunchValue(target.chatSessionId);
  if (chatSessionId) {
    params.set('chatSessionId', chatSessionId);
  }

  const viewMode = normalizeLaunchViewMode(target.viewMode);
  if (viewMode) {
    params.set('viewMode', viewMode);
  }

  return `?${params.toString()}`;
}

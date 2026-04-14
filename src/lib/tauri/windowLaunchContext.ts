export interface WindowLaunchContext {
  isNewWindow: boolean;
  vaultPath: string | null;
  notePath: string | null;
}

interface WindowLaunchTarget {
  vaultPath?: string | null;
  notePath?: string | null;
}

function normalizeLaunchValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function readWindowLaunchContext(search: string = window.location.search): WindowLaunchContext {
  const params = new URLSearchParams(search);

  return {
    isNewWindow: params.get('newWindow') === 'true',
    vaultPath: normalizeLaunchValue(params.get('vaultPath')),
    notePath: normalizeLaunchValue(params.get('notePath')),
  };
}

export function buildWindowLaunchSearch(target: WindowLaunchTarget = {}) {
  const params = new URLSearchParams();
  params.set('newWindow', 'true');

  const vaultPath = normalizeLaunchValue(target.vaultPath);
  if (vaultPath) {
    params.set('vaultPath', vaultPath);
  }

  const notePath = normalizeLaunchValue(target.notePath);
  if (notePath) {
    params.set('notePath', notePath);
  }

  return `?${params.toString()}`;
}

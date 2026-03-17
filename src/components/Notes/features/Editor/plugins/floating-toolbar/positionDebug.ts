const PREFIX = '[FloatingToolbarPosition]';
const DEBUG_STORAGE_KEY = 'debug:floating-toolbar-position';

function isDebugEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function logFloatingToolbarPosition(
  message: string,
  payload?: Record<string, unknown>
) {
  if (!isDebugEnabled()) {
    return;
  }

  if (payload) {
    console.log(`${PREFIX} ${message}`, payload);
    return;
  }

  console.log(`${PREFIX} ${message}`);
}

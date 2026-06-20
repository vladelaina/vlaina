interface IconPickerDebugEntry {
  at: string;
  event: string;
  details?: Record<string, unknown>;
}

declare global {
  interface Window {
    __vlainaIconPickerDebugLog?: IconPickerDebugEntry[];
  }
}

const MAX_DEBUG_ENTRIES = 200;
const DEBUG_STORAGE_KEY = 'vlaina-icon-picker-debug';

function isLocalStorageDebugEnabled() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isIconPickerDebugEnabled() {
  return Boolean(import.meta.env.DEV || isLocalStorageDebugEnabled());
}

export function describeIconPickerDebugTarget(target: EventTarget | null): string {
  if (!(target instanceof Element)) {
    return target ? target.constructor.name : 'null';
  }

  const tag = target.tagName.toLowerCase();
  const id = target.id ? `#${target.id}` : '';
  const className = typeof target.className === 'string'
    ? target.className.trim().split(/\s+/).filter(Boolean).slice(0, 5).join('.')
    : '';
  const classes = className ? `.${className}` : '';
  const dataKeys = Object.keys((target as HTMLElement).dataset ?? {}).slice(0, 5);
  const data = dataKeys.length ? `[data:${dataKeys.join(',')}]` : '';

  return `${tag}${id}${classes}${data}`;
}

export function logIconPickerDebug(event: string, details?: Record<string, unknown>) {
  if (!isIconPickerDebugEnabled() || typeof window === 'undefined') {
    return;
  }

  const entry: IconPickerDebugEntry = {
    at: new Date().toISOString(),
    event,
    details,
  };
  const currentLog = window.__vlainaIconPickerDebugLog ?? [];
  window.__vlainaIconPickerDebugLog = [...currentLog, entry].slice(-MAX_DEBUG_ENTRIES);

  if (isLocalStorageDebugEnabled() && typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug('[icon-picker]', event, details ?? {});
  }
}

export function getIconPickerDebugLogText() {
  const entries = typeof window === 'undefined'
    ? []
    : window.__vlainaIconPickerDebugLog ?? [];

  return JSON.stringify({
    href: typeof window === 'undefined' ? null : window.location.href,
    userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    entries,
  }, null, 2);
}

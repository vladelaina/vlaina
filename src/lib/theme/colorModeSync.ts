export type ColorModePreference = 'system' | 'light' | 'dark';
export type ResolvedColorMode = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function normalizeColorModePreference(value: unknown): ColorModePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function applyDocumentColorModeClass(mode: ResolvedColorMode): void {
  if (typeof document === 'undefined') return;

  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.classList.toggle('light', mode === 'light');
  document.documentElement.style.colorScheme = mode;
}

export function syncDocumentColorModeClass(preference: unknown): () => void {
  const mode = normalizeColorModePreference(preference);

  if (mode !== 'system') {
    applyDocumentColorModeClass(mode);
    return () => undefined;
  }

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    applyDocumentColorModeClass('light');
    return () => undefined;
  }

  const query = window.matchMedia(DARK_QUERY);
  const applySystemMode = () => applyDocumentColorModeClass(query.matches ? 'dark' : 'light');
  applySystemMode();

  query.addEventListener?.('change', applySystemMode);
  return () => {
    query.removeEventListener?.('change', applySystemMode);
  };
}

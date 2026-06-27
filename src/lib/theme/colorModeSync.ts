export type ColorModePreference = 'system' | 'light' | 'dark';
export type ResolvedColorMode = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_TRANSITION_SUPPRESSION_ATTRIBUTE = 'data-vlaina-theme-transition-suppression';

let transitionSuppressionStyle: HTMLStyleElement | null = null;
let transitionSuppressionRemoveTimer: number | null = null;

export function normalizeColorModePreference(value: unknown): ColorModePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function applyDocumentColorModeClass(mode: ResolvedColorMode): void {
  if (typeof document === 'undefined') return;

  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.classList.toggle('light', mode === 'light');
  document.documentElement.style.colorScheme = mode;
}

export function suppressDocumentThemeTransitions(): () => void {
  if (typeof document === 'undefined') return () => undefined;

  if (transitionSuppressionRemoveTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(transitionSuppressionRemoveTimer);
    transitionSuppressionRemoveTimer = null;
  }

  if (!transitionSuppressionStyle) {
    transitionSuppressionStyle = document.createElement('style');
    transitionSuppressionStyle.setAttribute(THEME_TRANSITION_SUPPRESSION_ATTRIBUTE, 'true');
    transitionSuppressionStyle.appendChild(document.createTextNode(
      '*,*::before,*::after{transition:none!important}'
    ));
    document.head.appendChild(transitionSuppressionStyle);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;

    if (typeof window === 'undefined') {
      transitionSuppressionStyle?.remove();
      transitionSuppressionStyle = null;
      return;
    }

    window.getComputedStyle(document.body).transitionProperty;
    transitionSuppressionRemoveTimer = window.setTimeout(() => {
      transitionSuppressionStyle?.remove();
      transitionSuppressionStyle = null;
      transitionSuppressionRemoveTimer = null;
    }, 1);
  };
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

import { getElectronBridge } from '@/lib/electron/bridge';
import { isLocalNetworkHttpUrl } from '@/lib/notes/markdown/urlSecurity';

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'weixin:']);
const UNSAFE_EXTERNAL_URL_CHARS_REGEX = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const HTTP_AUTHORITY_URL_PATTERN = /^https?:\/\//i;
export const MAX_DESKTOP_EXTERNAL_URL_CHARS = 4096;

export function normalizeDesktopExternalUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') {
    return null;
  }
  if (url.length > MAX_DESKTOP_EXTERNAL_URL_CHARS) {
    return null;
  }

  const trimmed = url.trim();
  if (
    !trimmed
    || trimmed.length > MAX_DESKTOP_EXTERNAL_URL_CHARS
    || UNSAFE_EXTERNAL_URL_CHARS_REGEX.test(trimmed)
  ) {
    return null;
  }
  if (trimmed.includes('\\')) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (!EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !HTTP_AUTHORITY_URL_PATTERN.test(trimmed)) {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && isLocalNetworkHttpUrl(parsed.toString())) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  const normalized = normalizeDesktopExternalUrl(url);
  if (!normalized) {
    throw new Error('Unsupported external URL.');
  }

  const bridge = getElectronBridge();
  if (!bridge) {
    if (typeof window !== 'undefined') {
      window.open(normalized, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  await bridge.shell.openExternal(normalized);
}

export async function revealItemInFolder(filePath: string): Promise<void> {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Open file location is only available in the desktop app.');
  }

  await bridge.shell.revealItem(filePath);
}

export async function openPathInFileManager(filePath: string): Promise<void> {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Open folder is only available in the desktop app.');
  }

  await bridge.shell.openPath(filePath);
}

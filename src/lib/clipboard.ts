import { getElectronBridge } from '@/lib/electron/bridge';
import { themeDomStyleTokens, themeOffscreenTokens } from '@/styles/themeTokens';

function tryExecCommandCopy(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    return false;
  }

  const activeElement = document.activeElement;
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  const selectedRanges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = themeDomStyleTokens.positionFixed;
  textarea.style.left = themeOffscreenTokens.clipboardLeft;
  textarea.style.top = themeOffscreenTokens.clipboardTop;
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (selection) {
      selection.removeAllRanges();
      selectedRanges.forEach((range) => selection.addRange(range));
    }
    if (activeElement instanceof HTMLElement) {
      activeElement.focus({ preventScroll: true });
    }
  }
}

export async function writeTextToClipboard(text: string): Promise<boolean> {
  const desktopClipboard = getElectronBridge()?.clipboard;
  if (desktopClipboard?.writeText) {
    try {
      await desktopClipboard.writeText(text);
      return true;
    } catch {
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
    }
  }

  return tryExecCommandCopy(text);
}

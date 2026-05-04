import type { EditorView } from '@milkdown/kit/prose/view';
import { logNotesDebug } from '@/stores/notes/debugLog';
import { getScrollRoot, getToolbarRoot, toContainerPosition } from '../floating-toolbar/floatingToolbarDom';
import { getContentLayoutContext } from '../floating-toolbar/floatingToolbarLayout';
import { renderUrlRailEditor } from '../floating-toolbar/components/UrlRailEditor';
import { isSupportedVideoUrl, normalizeVideoUrlInput, sanitizeVideoDebugPayload } from '../video';

const VIDEO_PROMPT_MARGIN_PX = 12;

function logSlashVideoDebug(event: string, payload: Record<string, unknown>) {
  const debugPayload = sanitizeVideoDebugPayload(payload);
  logNotesDebug(`slashVideoPrompt:${event}`, debugPayload);
  console.info(`[slashVideoPrompt:${event}]`, debugPayload);
}

function getPromptPosition(view: EditorView) {
  try {
    const coords = view.coordsAtPos(view.state.selection.from);
    return {
      x: coords.left,
      y: coords.bottom + 8,
    };
  } catch {
    return {
      x: 16,
      y: 16,
    };
  }
}

export function openSlashVideoPrompt(args: {
  view: EditorView;
  onSubmit: (url: string) => void | Promise<void>;
}) {
  const { view, onSubmit } = args;
  const scrollRoot = getScrollRoot(view);
  const positionRoot = getToolbarRoot(view) ?? scrollRoot;
  const prompt = document.createElement('div');
  const close = () => {
    document.removeEventListener('mousedown', handleOutsideMouseDown, true);
    prompt.remove();
  };
  const handleOutsideMouseDown = (event: MouseEvent) => {
    if (event.target instanceof Node && prompt.contains(event.target)) return;
    close();
    view.focus();
  };

  prompt.className = 'slash-video-prompt';
  prompt.style.position = positionRoot ? 'absolute' : 'fixed';
  (positionRoot ?? document.body).append(prompt);
  renderUrlRailEditor(prompt, {
    placeholder: 'Paste video URL...',
    hint: 'Press Enter to embed video',
    autoFocus: true,
    validate(url) {
      const normalizedUrl = normalizeVideoUrlInput(url);
      const supported = normalizedUrl !== null && isSupportedVideoUrl(normalizedUrl);
      if (!supported) {
        logSlashVideoDebug('validate_unsupported', {
          url,
        });
      }
      return supported;
    },
    onSubmit(url) {
      const normalizedUrl = normalizeVideoUrlInput(url);
      if (!normalizedUrl) return;
      close();
      onSubmit(normalizedUrl);
      view.focus();
    },
    onCancel() {
      close();
      view.focus();
    },
  });

  const viewportPosition = getPromptPosition(view);
  const containerPosition = toContainerPosition(viewportPosition, positionRoot);
  const layout = getContentLayoutContext(view, positionRoot);
  const promptWidth = prompt.offsetWidth || 320;
  const horizontalBounds = positionRoot
    ? {
        left: layout.containerBounds?.left ?? VIDEO_PROMPT_MARGIN_PX,
        right: layout.containerBounds?.right ?? positionRoot.clientWidth,
      }
    : {
        left: layout.viewportBounds.left,
        right: layout.viewportBounds.right,
      };
  const minX = horizontalBounds.left + VIDEO_PROMPT_MARGIN_PX;
  const maxX = horizontalBounds.right - VIDEO_PROMPT_MARGIN_PX - promptWidth;
  const x = maxX < minX ? minX : Math.max(minX, Math.min(containerPosition.x, maxX));

  prompt.style.left = `${Math.round(x)}px`;
  prompt.style.top = `${Math.round(containerPosition.y)}px`;
  document.addEventListener('mousedown', handleOutsideMouseDown, true);
}

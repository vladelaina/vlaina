import { EditorView as CodeMirror, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { CARET_MIN_VISUAL_HEIGHT, resolveElementLineHeight } from '@/lib/ui/caretOverlayStyles';

interface CodeMirrorCaretGeometryInput {
  height: number;
  lineHeight: number;
  top: number;
}

interface CodeMirrorCaretGeometry {
  height: number;
  top: number;
}

interface MeasuredCodeMirrorCaret {
  cursor: HTMLElement;
  geometry: CodeMirrorCaretGeometry;
}

const CODE_BLOCK_CARET_MEASURE_KEY = {};

export function fitCodeMirrorCaretToLineHeight({
  height,
  lineHeight,
  top,
}: CodeMirrorCaretGeometryInput): CodeMirrorCaretGeometry {
  const targetHeight = Math.max(CARET_MIN_VISUAL_HEIGHT, lineHeight);
  return {
    height: targetHeight,
    top: top + (height - targetHeight) / 2,
  };
}

function parseInlinePixels(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function measureCodeMirrorCarets(view: CodeMirror): MeasuredCodeMirrorCaret[] {
  const lineHeight = resolveElementLineHeight(view.contentDOM.querySelector('.cm-line'));
  if (lineHeight === null) return [];

  return Array.from(view.dom.querySelectorAll<HTMLElement>('.cm-cursor')).flatMap((cursor) => {
    const height = parseInlinePixels(cursor.style.height);
    const top = parseInlinePixels(cursor.style.top);
    if (height === null || height <= 0 || top === null) return [];
    if (Math.abs(height - lineHeight) < 0.01) return [];

    return [{
      cursor,
      geometry: fitCodeMirrorCaretToLineHeight({ height, lineHeight, top }),
    }];
  });
}

function syncCodeMirrorCaretGeometry(view: CodeMirror): void {
  view.requestMeasure({
    key: CODE_BLOCK_CARET_MEASURE_KEY,
    read: measureCodeMirrorCarets,
    write: (carets) => {
      carets.forEach(({ cursor, geometry }) => {
        cursor.style.top = `${geometry.top}px`;
        cursor.style.height = `${geometry.height}px`;
      });
    },
  });
}

class CodeBlockCaretGeometryView {
  private readonly resizeObserver: ResizeObserver | null;

  constructor(private readonly view: CodeMirror) {
    this.resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => syncCodeMirrorCaretGeometry(this.view));
    this.resizeObserver?.observe(view.contentDOM);
    syncCodeMirrorCaretGeometry(view);
  }

  update(update: ViewUpdate): void {
    if (
      update.docChanged ||
      update.focusChanged ||
      update.geometryChanged ||
      update.selectionSet ||
      update.viewportChanged
    ) {
      syncCodeMirrorCaretGeometry(update.view);
    }
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
  }
}

export const codeBlockCaretGeometryPlugin = ViewPlugin.fromClass(CodeBlockCaretGeometryView);

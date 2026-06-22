import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorSelection, Prec, RangeSetBuilder, StateField } from '@codemirror/state';
import { Decoration, EditorView as CodeMirror, highlightSpecialChars, ViewPlugin } from '@codemirror/view';
import { CARET_BLINK_HELD_ATTR, holdCaretBlink, isCaretNavigationKey } from '@/lib/ui/caretOverlayStyles';
import { themeCaretOverlayTokens, themeCodeBlockEditorTokens, themeStyleResetTokens } from '@/styles/themeTokens';
import { codeBlockHighlightStyle } from './codeBlockHighlightStyle';
import { codeBlockCompatibilityHighlightStyle } from './codeBlockCompatibilityHighlightStyle';

const selectedTextDecoration = Decoration.mark({
  class: 'editor-code-selection-text',
});

const CODE_BLOCK_LINE_CLASS = 'HyperMD-codeblock HyperMD-codeblock-bg cm-hmd-codeblock';
const CODE_BLOCK_BEGIN_LINE_CLASS = `${CODE_BLOCK_LINE_CLASS} HyperMD-codeblock-begin HyperMD-codeblock-begin-bg`;
const CODE_BLOCK_END_LINE_CLASS = `${CODE_BLOCK_LINE_CLASS} HyperMD-codeblock-end HyperMD-codeblock-end-bg`;
const CODE_BLOCK_SINGLE_LINE_CLASS = `${CODE_BLOCK_BEGIN_LINE_CLASS} HyperMD-codeblock-end HyperMD-codeblock-end-bg`;

const codeBlockCaretNavigationActiveViews = new WeakSet<CodeMirror>();

function holdCodeBlockCaretBlink(view: CodeMirror): void {
  holdCaretBlink(view.dom, codeBlockCaretNavigationActiveViews.has(view) ? null : undefined);
}

function resolveCodeBlockTextNodeCaretPositionAtPointer(view: CodeMirror, event: MouseEvent): number | null {
  const ownerDocument = view.dom.ownerDocument;
  const hitElement = ownerDocument.elementFromPoint?.(event.clientX, event.clientY);
  const root = hitElement && view.contentDOM.contains(hitElement) ? hitElement : view.contentDOM;
  const showText = ownerDocument.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
  const walker = ownerDocument.createTreeWalker(root, showText);
  const range = ownerDocument.createRange();
  let best: { distance: number; node: Text; offset: number } | null = null;

  try {
    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      if (!textNode.data) continue;

      range.selectNodeContents(textNode);
      const textNodeRects = Array.from(range.getClientRects());
      const isOnClickedLine = textNodeRects.some((rect) =>
        rect.width > 0 &&
        rect.height > 0 &&
        event.clientY >= rect.top - 3 &&
        event.clientY <= rect.bottom + 3
      );
      if (!isOnClickedLine) continue;

      for (let offset = 0; offset < textNode.data.length; offset += 1) {
        range.setStart(textNode, offset);
        range.setEnd(textNode, offset + 1);
        for (const rect of Array.from(range.getClientRects())) {
          if (rect.width <= 0 || rect.height <= 0) continue;

          const verticalDistance = event.clientY < rect.top
            ? rect.top - event.clientY
            : event.clientY > rect.bottom
              ? event.clientY - rect.bottom
              : 0;
          if (verticalDistance > Math.max(4, rect.height / 2)) continue;

          const horizontalDistance = event.clientX < rect.left
            ? rect.left - event.clientX
            : event.clientX > rect.right
              ? event.clientX - rect.right
              : 0;
          const centerY = rect.top + rect.height / 2;
          const distance = horizontalDistance + Math.abs(event.clientY - centerY) * 2;
          if (best && distance >= best.distance) continue;

          best = {
            distance,
            node: textNode,
            offset: event.clientX <= rect.left + rect.width / 2 ? offset : offset + 1,
          };
        }
      }
    }
  } finally {
    range.detach();
  }

  if (!best) return null;
  try {
    return view.posAtDOM(best.node, best.offset);
  } catch {
    return null;
  }
}

function resolveCodeBlockCaretPositionAtPointer(view: CodeMirror, event: MouseEvent): number | null {
  const textNodePosition = resolveCodeBlockTextNodeCaretPositionAtPointer(view, event);
  if (textNodePosition !== null) {
    return textNodePosition;
  }

  const coordsPosition = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (coordsPosition !== null) {
    return coordsPosition;
  }

  const ownerDocument = view.dom.ownerDocument as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const caretPosition = ownerDocument.caretPositionFromPoint?.(event.clientX, event.clientY);
  const caretRange = caretPosition
    ? null
    : ownerDocument.caretRangeFromPoint?.(event.clientX, event.clientY);
  const node = caretPosition?.offsetNode ?? caretRange?.startContainer ?? null;
  const offset = caretPosition?.offset ?? caretRange?.startOffset ?? null;

  if (node && offset !== null && view.contentDOM.contains(node)) {
    try {
      return view.posAtDOM(node, offset);
    } catch {
    }
  }

  return null;
}

function isPositionInsideCodeBlockSelection(view: CodeMirror, position: number): boolean {
  return view.state.selection.ranges.some((range) => !range.empty && position >= range.from && position <= range.to);
}

function hasCodeBlockSelection(view: CodeMirror): boolean {
  return view.state.selection.ranges.some((range) => !range.empty);
}

function applyResolvedCodeBlockPointerSelection(view: CodeMirror, event: MouseEvent): boolean {
  const position = resolveCodeBlockBlankContentClickPosition(view, event);
  if (position === null) {
    return false;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  view.dispatch({
    selection: EditorSelection.cursor(position),
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

const codeBlockPointerSelectionPlugin = ViewPlugin.fromClass(class {
  private suppressNextMouseDown = false;

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (applyResolvedCodeBlockPointerSelection(this.view, event)) {
      this.suppressNextMouseDown = true;
    }
  };

  private readonly handleMouseDown = (event: MouseEvent) => {
    if (this.suppressNextMouseDown) {
      this.suppressNextMouseDown = false;
      if (event.button === 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    applyResolvedCodeBlockPointerSelection(this.view, event);
  };

  constructor(private readonly view: CodeMirror) {
    view.dom.addEventListener('pointerdown', this.handlePointerDown, true);
    view.dom.addEventListener('mousedown', this.handleMouseDown, true);
  }

  destroy() {
    this.view.dom.removeEventListener('pointerdown', this.handlePointerDown, true);
    this.view.dom.removeEventListener('mousedown', this.handleMouseDown, true);
  }
});

export function resolveCodeBlockBlankContentClickPosition(view: CodeMirror, event: MouseEvent): number | null {
  if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }

  const target = event.target;
  if (!(target instanceof Node) || !view.dom.contains(target)) {
    return null;
  }

  const element = target instanceof Element ? target : target.parentElement;
  if (!element || element.closest('.cm-gutters, .cm-gutter, .cm-gutterElement')) {
    return null;
  }

  if (hasCodeBlockSelection(view)) {
    const caretPosition = resolveCodeBlockCaretPositionAtPointer(view, event);
    if (caretPosition !== null && isPositionInsideCodeBlockSelection(view, caretPosition)) {
      return caretPosition;
    }
  }

  const lineBlock = view.lineBlockAtHeight(event.clientY - view.documentTop);
  const line = view.state.doc.lineAt(lineBlock.from);
  const lineElement = element.closest('.cm-line');
  if (lineElement) {
    const lineEndCoords = view.coordsAtPos(line.to, 1) ?? view.coordsAtPos(line.to);
    if (!lineEndCoords || event.clientX < lineEndCoords.right) {
      return null;
    }
  } else if (!view.contentDOM.contains(target) && !view.scrollDOM.contains(target)) {
    return null;
  }

  return line.to;
}

function buildSelectedTextDecorations(selection: EditorSelection) {
  const builder = new RangeSetBuilder<Decoration>();

  for (const range of selection.ranges) {
    if (range.empty) {
      continue;
    }

    builder.add(range.from, range.to, selectedTextDecoration);
  }

  return builder.finish();
}

const codeBlockSelectedTextField = StateField.define({
  create(state) {
    return buildSelectedTextDecorations(state.selection);
  },
  update(value, tr) {
    if (!tr.docChanged && !tr.selection) {
      return value;
    }

    return buildSelectedTextDecorations(tr.state.selection);
  },
  provide: (field) => CodeMirror.decorations.from(field),
});

function buildCodeBlockLineDecorations(state: { doc: { lines: number; line: (lineNumber: number) => { from: number } } }) {
  const builder = new RangeSetBuilder<Decoration>();
  const lineCount = Math.max(1, state.doc.lines);

  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const isFirst = lineNumber === 1;
    const isLast = lineNumber === lineCount;
    const className = isFirst && isLast
      ? CODE_BLOCK_SINGLE_LINE_CLASS
      : isFirst
        ? CODE_BLOCK_BEGIN_LINE_CLASS
        : isLast
          ? CODE_BLOCK_END_LINE_CLASS
          : CODE_BLOCK_LINE_CLASS;

    builder.add(line.from, line.from, Decoration.line({ class: className }));
  }

  return builder.finish();
}

const codeBlockCompatibilityLineField = StateField.define({
  create: buildCodeBlockLineDecorations,
  update(value, tr) {
    if (!tr.docChanged) return value;
    return buildCodeBlockLineDecorations(tr.state);
  },
  provide: (field) => CodeMirror.decorations.from(field),
});

export function createCodeBlockEditorTheme() {
  return [
    syntaxHighlighting(codeBlockHighlightStyle),
    syntaxHighlighting(codeBlockCompatibilityHighlightStyle),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    highlightSpecialChars(),
    Prec.highest(codeBlockSelectedTextField),
    Prec.highest(codeBlockCompatibilityLineField),
    Prec.highest(codeBlockPointerSelectionPlugin),
    Prec.highest(CodeMirror.mouseSelectionStyle.of((view, event) => {
      const position = resolveCodeBlockBlankContentClickPosition(view, event);
      if (position === null) {
        return null;
      }

      return {
        get: () => EditorSelection.single(position),
        update: () => false,
      };
    })),
    CodeMirror.domEventHandlers({
      mousedown(event, view) {
        return applyResolvedCodeBlockPointerSelection(view, event);
      },
      keydown(event, view) {
        if (event.isComposing) {
          return false;
        }

        if (isCaretNavigationKey(event)) {
          codeBlockCaretNavigationActiveViews.add(view);
          holdCodeBlockCaretBlink(view);
        }
        return false;
      },
      keyup(event, view) {
        if (event.isComposing) {
          return false;
        }

        if (isCaretNavigationKey(event)) {
          codeBlockCaretNavigationActiveViews.delete(view);
          holdCodeBlockCaretBlink(view);
        }
        return false;
      },
    }),
    CodeMirror.updateListener.of((update) => {
      if (update.focusChanged && !update.view.hasFocus) {
        codeBlockCaretNavigationActiveViews.delete(update.view);
      }
      if (update.selectionSet || update.docChanged || update.focusChanged) {
        holdCodeBlockCaretBlink(update.view);
      }
    }),
    CodeMirror.theme({
      '&': {
        backgroundColor: 'var(--vlaina-code-block-background)',
        color: 'var(--vlaina-code-syntax-foreground)',
        fontSize: themeCodeBlockEditorTokens.fontSize,
      },
      '.cm-editor': {
        backgroundColor: 'var(--vlaina-code-block-background)',
      },
      '.cm-scroller': {
        fontFamily: 'var(--font-mono), monospace',
        lineHeight: themeCodeBlockEditorTokens.lineHeight,
        overflowX: 'auto',
        textRendering: 'auto',
        fontKerning: 'none',
        fontVariantLigatures: 'none',
        fontFeatureSettings: '"liga" 0, "calt" 0, "dlig" 0',
      },
      '.cm-content, .cm-line, .cm-gutter, .cm-gutterElement': {
        fontFamily: 'inherit',
        textRendering: 'inherit',
        fontKerning: 'inherit',
        fontVariantLigatures: 'inherit',
        fontFeatureSettings: 'inherit',
      },
      '.cm-content': {
        padding: themeCodeBlockEditorTokens.contentPadding,
        minHeight: themeCodeBlockEditorTokens.contentMinHeight,
        caretColor: themeStyleResetTokens.colorTransparentImportant,
      },
      '.cm-line': {
        padding: themeCodeBlockEditorTokens.linePadding,
      },
      '.cm-gutters': {
        position: 'sticky',
        left: themeCodeBlockEditorTokens.contentPadding,
        zIndex: themeCodeBlockEditorTokens.gutterZIndex,
        paddingLeft: themeCodeBlockEditorTokens.gutterPaddingLeft,
        color: 'var(--vlaina-code-syntax-muted)',
        backgroundColor: 'var(--vlaina-code-block-background) !important',
        borderRight: themeStyleResetTokens.borderNoneImportant,
        border: themeStyleResetTokens.borderNoneImportant,
      },
      '.cm-gutter, .cm-lineNumbers, .cm-gutterElement, .cm-gutter-filler': {
        backgroundColor: 'var(--vlaina-code-block-background) !important',
        borderRight: themeStyleResetTokens.borderNoneImportant,
        border: themeStyleResetTokens.borderNoneImportant,
      },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: themeStyleResetTokens.backgroundTransparent,
      },
      '&.cm-focused': {
        outline: themeStyleResetTokens.outlineNone,
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--vlaina-selection-bg)',
      },
      '.cm-selectionLayer, .cm-selectionBackground': {
        pointerEvents: 'none',
      },
      '.cm-selectionBackground': {
        backgroundColor: themeStyleResetTokens.backgroundTransparent,
      },
      '.editor-code-selection-text, .editor-code-selection-text *': {
        color: 'var(--vlaina-color-white) !important',
        WebkitTextFillColor: 'var(--vlaina-color-white) !important',
      },
      '.cm-cursor, .cm-dropCursor, &.cm-focused .cm-cursor, &.cm-focused .cm-dropCursor': {
        borderLeftColor: 'var(--vlaina-caret-color) !important',
        borderLeftStyle: 'solid',
        borderLeftWidth: 'var(--vlaina-caret-width)',
      },
      [`&[${CARET_BLINK_HELD_ATTR}="true"] .cm-cursorLayer`]: {
        animation: `${themeStyleResetTokens.animationNone} !important`,
        opacity: `${themeCaretOverlayTokens.opacityVisible} !important`,
      },
      [`&[${CARET_BLINK_HELD_ATTR}="true"] .cm-cursor`]: {
        opacity: `${themeCaretOverlayTokens.opacityVisible} !important`,
      },
    }, { dark: false }),
  ];
}

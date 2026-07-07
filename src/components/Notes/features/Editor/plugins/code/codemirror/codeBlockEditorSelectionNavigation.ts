import type { EditorView as CodeMirror } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

function getCurrentOrNearestNonEmptyLineBounds(
  cm: CodeMirror,
  direction: -1 | 1
): { from: number; to: number } | null {
  const currentLine = cm.state.doc.lineAt(cm.state.selection.main.head);
  if (currentLine.text.trim().length > 0) {
    return { from: currentLine.from, to: currentLine.to };
  }

  for (
    let lineNumber = currentLine.number + direction;
    lineNumber >= 1 && lineNumber <= cm.state.doc.lines;
    lineNumber += direction
  ) {
    const line = cm.state.doc.line(lineNumber);
    if (line.text.trim().length > 0) {
      return { from: line.from, to: line.to };
    }
  }

  return null;
}

function getNonEmptyLineBoundsFromLineNumber(
  cm: CodeMirror,
  lineNumber: number,
  direction: -1 | 1
): { from: number; to: number } | null {
  for (
    let currentLineNumber = lineNumber;
    currentLineNumber >= 1 && currentLineNumber <= cm.state.doc.lines;
    currentLineNumber += direction
  ) {
    const line = cm.state.doc.line(currentLineNumber);
    if (line.text.trim().length > 0) {
      return { from: line.from, to: line.to };
    }
  }

  return null;
}

function getNextNonEmptyLineBoundsOutsideSelection(
  cm: CodeMirror,
  direction: -1 | 1
): { from: number; to: number } | null {
  const selection = cm.state.selection.main;
  if (selection.empty) {
    return getCurrentOrNearestNonEmptyLineBounds(cm, direction);
  }

  if (direction < 0) {
    const topLine = cm.state.doc.lineAt(selection.from);
    const startLineNumber =
      topLine.text.trim().length > 0 && selection.from <= topLine.from
        ? topLine.number - 1
        : topLine.number;
    return getNonEmptyLineBoundsFromLineNumber(cm, startLineNumber, direction);
  }

  const bottomLine = cm.state.doc.lineAt(selection.to);
  const startLineNumber =
    bottomLine.text.trim().length > 0 && selection.to >= bottomLine.to
      ? bottomLine.number + 1
      : bottomLine.number;
  return getNonEmptyLineBoundsFromLineNumber(cm, startLineNumber, direction);
}

export function moveOrExtendToTrimmedCodeBoundary(
  getCodeMirror: () => CodeMirror | undefined,
  direction: -1 | 1,
  extend: boolean
): boolean {
  const cm = getCodeMirror();
  if (!cm) {
    return false;
  }

  const currentSelection = cm.state.selection.main;
  const targetLine = extend && !currentSelection.empty
    ? getNextNonEmptyLineBoundsOutsideSelection(cm, direction)
    : getCurrentOrNearestNonEmptyLineBounds(cm, direction);
  if (!targetLine) {
    return false;
  }

  const nextSelection = extend
    ? currentSelection.empty
      ? EditorSelection.single(
        direction < 0 ? targetLine.to : targetLine.from,
        direction < 0 ? targetLine.from : targetLine.to
      )
      : EditorSelection.single(
        direction < 0 ? currentSelection.to : currentSelection.from,
        direction < 0 ? targetLine.from : targetLine.to
      )
    : EditorSelection.cursor(direction < 0 ? targetLine.from : targetLine.to);

  cm.dispatch({ selection: nextSelection });
  cm.focus();
  return true;
}

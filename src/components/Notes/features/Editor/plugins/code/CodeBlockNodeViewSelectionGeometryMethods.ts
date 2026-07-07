import { type Text } from '@codemirror/state';

type CodeMirrorLineBounds = {
  from: number;
  to: number;
};

type CodeMirrorSelectionLike = {
  anchor: number;
  empty: boolean;
  from: number;
  head: number;
  to: number;
};

type NormalizedCodeMirrorSelection = {
  anchor: number;
  head: number;
};

class CodeBlockNodeViewSelectionGeometryMethods {
  getNonEmptyLineBoundsAtOrAfter(this: any, doc: Text, pos: number): CodeMirrorLineBounds | null {
    if (doc.lines === 0) {
      return null;
    }

    const clampedPos = Math.max(0, Math.min(pos, doc.length));
    const startLine = doc.lineAt(clampedPos).number;
    for (let lineNumber = startLine; lineNumber <= doc.lines; lineNumber += 1) {
      const line = doc.line(lineNumber);
      if (line.text.trim().length > 0) {
        return { from: line.from, to: line.to };
      }
    }

    return null;
  }

  getNonEmptyLineBoundsAtOrBefore(this: any, doc: Text, pos: number): CodeMirrorLineBounds | null {
    if (doc.lines === 0) {
      return null;
    }

    const clampedPos = Math.max(0, Math.min(pos, doc.length));
    const startLine = doc.lineAt(clampedPos).number;
    for (let lineNumber = startLine; lineNumber >= 1; lineNumber -= 1) {
      const line = doc.line(lineNumber);
      if (line.text.trim().length > 0) {
        return { from: line.from, to: line.to };
      }
    }

    return null;
  }

  getAdjacentNonEmptyLineBounds(this: any, doc: Text, pos: number): CodeMirrorLineBounds | null {
    if (doc.lines === 0) {
      return null;
    }

    const clampedPos = Math.max(0, Math.min(pos, doc.length));
    const currentLine = doc.lineAt(clampedPos);
    if (currentLine.text.trim().length > 0) {
      return { from: currentLine.from, to: currentLine.to };
    }

    if (currentLine.number > 1) {
      const previousLine = doc.line(currentLine.number - 1);
      if (previousLine.text.trim().length > 0 && previousLine.to + 1 >= clampedPos) {
        return { from: previousLine.from, to: previousLine.to };
      }
    }

    if (currentLine.number < doc.lines) {
      const nextLine = doc.line(currentLine.number + 1);
      if (nextLine.text.trim().length > 0 && currentLine.to + 1 >= nextLine.from - 1) {
        return { from: nextLine.from, to: nextLine.to };
      }
    }

    return null;
  }

  orientCodeMirrorLineSelection(this: any,
    lineBounds: CodeMirrorLineBounds,
    direction: -1 | 1
  ): NormalizedCodeMirrorSelection {
    return {
      anchor: direction > 0 ? lineBounds.from : lineBounds.to,
      head: direction > 0 ? lineBounds.to : lineBounds.from,
    };
  }

  getPureLineBreakSelectionTarget(this: any,
    doc: Text,
    selection: CodeMirrorSelectionLike,
    direction: -1 | 1
  ): CodeMirrorLineBounds | null {
    const directionalTarget = direction > 0
      ? this.getNonEmptyLineBoundsAtOrAfter(doc, selection.to)
      : this.getNonEmptyLineBoundsAtOrBefore(doc, selection.from);
    if (directionalTarget) {
      return directionalTarget;
    }

    return (
      this.getAdjacentNonEmptyLineBounds(doc, selection.anchor) ??
      this.getAdjacentNonEmptyLineBounds(doc, selection.head) ??
      (direction > 0
        ? this.getNonEmptyLineBoundsAtOrBefore(doc, selection.from)
        : this.getNonEmptyLineBoundsAtOrAfter(doc, selection.to))
    );
  }

  normalizeCodeMirrorSelectionEdgeLineBreaks(this: any,
    doc: Text,
    selection: CodeMirrorSelectionLike,
    previousSelection?: CodeMirrorSelectionLike
  ): NormalizedCodeMirrorSelection | null {
    if (selection.empty) {
      return null;
    }

    let nextFrom = selection.from;
    let nextTo = selection.to;
    while (nextFrom < nextTo && doc.sliceString(nextFrom, nextFrom + 1) === '\n') {
      nextFrom += 1;
    }
    while (nextTo > nextFrom && doc.sliceString(nextTo - 1, nextTo) === '\n') {
      nextTo -= 1;
    }

    const direction = selection.anchor <= selection.head ? 1 : -1;
    if (nextFrom >= nextTo) {
      const targetLine = this.getPureLineBreakSelectionTarget(doc, selection, direction);
      return targetLine
        ? this.orientCodeMirrorLineSelection(targetLine, direction)
        : null;
    }

    if (nextFrom === selection.from && nextTo === selection.to) {
      return null;
    }

    const previousRangeMatchesTrimmedSelection =
      previousSelection !== undefined &&
      !previousSelection.empty &&
      previousSelection.from === nextFrom &&
      previousSelection.to === nextTo;
    if (previousRangeMatchesTrimmedSelection) {
      const nextNonEmptyLine = direction > 0 && nextTo < selection.to
        ? this.getNonEmptyLineBoundsAtOrAfter(doc, selection.to)
        : direction < 0 && nextFrom > selection.from
          ? this.getNonEmptyLineBoundsAtOrBefore(doc, selection.from)
          : null;
      if (
        nextNonEmptyLine &&
        (nextNonEmptyLine.from !== nextFrom || nextNonEmptyLine.to !== nextTo)
      ) {
        return {
          anchor: direction > 0 ? previousSelection.from : previousSelection.to,
          head: direction > 0 ? nextNonEmptyLine.to : nextNonEmptyLine.from,
        };
      }
    }

    return {
      anchor: direction > 0 ? nextFrom : nextTo,
      head: direction > 0 ? nextTo : nextFrom,
    };
  }

}

function installMixinMethods(prototype: object, mixinPrototype: object): void {
  for (const key of Object.getOwnPropertyNames(mixinPrototype)) {
    if (key !== 'constructor') {
      Object.defineProperty(prototype, key, Object.getOwnPropertyDescriptor(mixinPrototype, key)!);
    }
  }
}

export function installCodeBlockNodeViewSelectionGeometryMethods(prototype: object): void {
  installMixinMethods(prototype, CodeBlockNodeViewSelectionGeometryMethods.prototype);
}

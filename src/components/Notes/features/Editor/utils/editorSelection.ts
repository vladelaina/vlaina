import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Selection, TextSelection } from '@milkdown/kit/prose/state';

function isInlineLineBreakNode(node: ProseNode): boolean {
  const nodeName = node.type.name;
  return (
    nodeName === 'hardbreak' ||
    nodeName === 'hard_break' ||
    nodeName === 'softbreak' ||
    nodeName === 'soft_break'
  );
}

function createCollapsedTextSelectionNear(doc: ProseNode, pos: number, bias: -1 | 1): Selection {
  try {
    return TextSelection.create(doc, pos);
  } catch {
    return Selection.near(doc.resolve(pos), bias);
  }
}

export function createDocumentStartTextSelection(doc: ProseNode): Selection {
  let textSelectionPos: number | null = null;

  doc.descendants((node, pos) => {
    if (textSelectionPos !== null) return false;
    if (node.isTextblock) {
      textSelectionPos = pos + 1;
      return false;
    }
    return true;
  });

  if (textSelectionPos !== null) {
    try {
      return TextSelection.create(doc, textSelectionPos);
    } catch {
      // Fall through to ProseMirror's nearest valid selection.
    }
  }

  return Selection.near(doc.resolve(0), 1);
}

export function createDocumentFirstLineEndTextSelection(doc: ProseNode): Selection {
  let textSelectionPos: number | null = null;

  doc.descendants((node, pos) => {
    if (textSelectionPos !== null) return false;
    if (!node.isTextblock) return true;

    let lineEndOffset = 0;
    let foundLineBreak = false;
    node.forEach((child) => {
      if (foundLineBreak) return;

      if (child.isText) {
        const text = child.text ?? '';
        const newlineIndex = text.indexOf('\n');
        if (newlineIndex >= 0) {
          lineEndOffset += newlineIndex;
          foundLineBreak = true;
          return;
        }
      }

      if (isInlineLineBreakNode(child)) {
        foundLineBreak = true;
        return;
      }

      lineEndOffset += child.nodeSize;
    });

    textSelectionPos = pos + 1 + lineEndOffset;
    return false;
  });

  if (textSelectionPos !== null) {
    return createCollapsedTextSelectionNear(doc, textSelectionPos, -1);
  }

  return Selection.near(doc.resolve(0), 1);
}

import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Selection, TextSelection } from '@milkdown/kit/prose/state';

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

import { TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import { isNodeContentEffectivelyEmpty } from '../shared/emptyParagraphNearBlockDeletion';
import {
  findTopLevelBlockAfter,
  findTopLevelBlockAt,
  findTopLevelBlockBefore,
  isNavigableAtomicBlock,
  setTransientInputParagraphSelection,
} from './atomicBlockKeyboardShared';

type AtomicSelectionRepairSide = 'before' | 'after';

interface AtomicSelectionRepairCandidate {
  side: AtomicSelectionRepairSide;
  typeName: string;
}

function collectAtomicSelectionRepairCandidates(state: EditorState): AtomicSelectionRepairCandidate[] {
  const { selection, doc } = state;
  if (!selection.empty) {
    return [];
  }

  const candidates: AtomicSelectionRepairCandidate[] = [];
  const selectedBlock = findTopLevelBlockAt(doc, selection.from);
  if (selectedBlock?.node.type.name === 'paragraph' && isNodeContentEffectivelyEmpty(selectedBlock.node)) {
    const previous = findTopLevelBlockBefore(doc, selectedBlock.from);
    const next = findTopLevelBlockAfter(doc, selectedBlock.to);
    if (
      previous &&
      isNavigableAtomicBlock(previous.node) &&
      (!next || next.node.type.name === 'paragraph')
    ) {
      candidates.push({ side: 'after', typeName: previous.node.type.name });
    }
    if (
      next &&
      isNavigableAtomicBlock(next.node) &&
      (!previous || previous.node.type.name === 'paragraph')
    ) {
      candidates.push({ side: 'before', typeName: next.node.type.name });
    }
    return candidates;
  }

  if (selection instanceof TextSelection && selection.$from.parent.isTextblock) {
    return [];
  }

  const cursorPos = Math.max(0, Math.min(selection.from, doc.content.size));
  const previous = findTopLevelBlockBefore(doc, cursorPos);
  const next = findTopLevelBlockAfter(doc, cursorPos);
  if (previous?.to === cursorPos && isNavigableAtomicBlock(previous.node)) {
    candidates.push({ side: 'after', typeName: previous.node.type.name });
  }
  if (next?.from === cursorPos && isNavigableAtomicBlock(next.node)) {
    candidates.push({ side: 'before', typeName: next.node.type.name });
  }

  return candidates;
}

export function createAtomicSelectionRepairTransaction(
  transactions: readonly Transaction[],
  oldState: EditorState,
  newState: EditorState
): Transaction | null {
  const selectedBlock = findTopLevelBlockAt(newState.doc, newState.selection.from);
  if (
    !selectedBlock ||
    !isNavigableAtomicBlock(selectedBlock.node) ||
    newState.selection.to > selectedBlock.to
  ) {
    return null;
  }

  if (transactions.some((tr) => tr.getMeta('pointer'))) {
    return null;
  }

  const candidate = collectAtomicSelectionRepairCandidates(oldState)
    .find((repairCandidate) => repairCandidate.typeName === selectedBlock.node.type.name);
  if (!candidate) {
    return null;
  }

  const insertPos = candidate.side === 'before' ? selectedBlock.from : selectedBlock.to;
  return setTransientInputParagraphSelection(newState, newState.tr, insertPos);
}

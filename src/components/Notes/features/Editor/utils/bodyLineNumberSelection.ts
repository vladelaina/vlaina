import type { BodyLineNumberLabelLayout } from './bodyLineNumberLayout';

export const MAX_BODY_LINE_NUMBER_SELECTION_SCAN_ELEMENTS = 20000;

const BLOCK_SELECTION_ACTIVE_CLASS = 'editor-block-selection-active';
const BLOCK_SELECTION_PENDING_CLASS = 'editor-block-selection-pending';
const MAX_INCREMENTAL_BODY_LINE_NUMBER_SELECTION_SYNC_ELEMENTS = 64;

export function collectSelectedBlockDescendantTargets(editorRoot: HTMLElement): WeakSet<HTMLElement> {
  const selectedDescendantTargets = new WeakSet<HTMLElement>();
  const walker = editorRoot.ownerDocument.createTreeWalker(editorRoot, NodeFilter.SHOW_ELEMENT);
  let scanned = 0;

  for (
    let node = walker.nextNode();
    node && scanned < MAX_BODY_LINE_NUMBER_SELECTION_SCAN_ELEMENTS;
    node = walker.nextNode()
  ) {
    scanned += 1;
    if (!(node instanceof HTMLElement) || !node.classList.contains('editor-block-selected')) {
      continue;
    }

    for (
      let ancestor = node.parentElement;
      ancestor && ancestor !== editorRoot;
      ancestor = ancestor.parentElement
    ) {
      selectedDescendantTargets.add(ancestor);
    }
  }

  return selectedDescendantTargets;
}

export function shouldCollectSelectedBlockDescendantTargets(editorRoot: HTMLElement): boolean {
  return editorRoot.classList.contains(BLOCK_SELECTION_ACTIVE_CLASS)
    || editorRoot.classList.contains(BLOCK_SELECTION_PENDING_CLASS);
}

export function isInsideSelectedBlock(
  target: HTMLElement,
  selectedDescendantTargets: WeakSet<HTMLElement> | null,
): boolean {
  return target.classList.contains('editor-block-selected')
    || target.closest('.editor-block-selected') !== null
    || selectedDescendantTargets?.has(target) === true;
}

function isInsideSelectedBlockFromCurrentDom(target: HTMLElement): boolean {
  return target.classList.contains('editor-block-selected')
    || target.closest('.editor-block-selected') !== null
    || target.querySelector('.editor-block-selected') !== null;
}

interface SyncBodyLineNumberLabelSelectionOptions {
  changedElements?: readonly Element[];
}

function collectIncrementalSelectionSyncIndexes(
  editorRoot: HTMLElement,
  targets: readonly HTMLElement[],
  changedElements: readonly Element[] | undefined,
): Set<number> | null {
  if (!changedElements || changedElements.length === 0) {
    return null;
  }
  if (changedElements.length > MAX_INCREMENTAL_BODY_LINE_NUMBER_SELECTION_SYNC_ELEMENTS) {
    return null;
  }

  const relevantChangedElements: HTMLElement[] = [];
  for (const element of changedElements) {
    if (!(element instanceof HTMLElement) || !editorRoot.contains(element) || element === editorRoot) {
      return null;
    }
    relevantChangedElements.push(element);
  }

  const indexes = new Set<number>();
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    if (!target || !editorRoot.contains(target)) {
      continue;
    }

    for (const element of relevantChangedElements) {
      if (target === element || target.contains(element) || element.contains(target)) {
        indexes.add(index);
        break;
      }
    }
  }

  return indexes;
}

export function syncBodyLineNumberLabelSelection(
  editorRoot: HTMLElement | null,
  layout: BodyLineNumberLabelLayout,
  options: SyncBodyLineNumberLabelSelectionOptions = {},
): BodyLineNumberLabelLayout {
  if (!editorRoot || layout.labels.length === 0 || layout.targets.length === 0) {
    return layout;
  }

  const incrementalSyncIndexes = collectIncrementalSelectionSyncIndexes(
    editorRoot,
    layout.targets,
    options.changedElements,
  );
  if (incrementalSyncIndexes && incrementalSyncIndexes.size === 0) {
    return layout;
  }

  const selectedDescendantTargets = incrementalSyncIndexes === null && shouldCollectSelectedBlockDescendantTargets(editorRoot)
    ? collectSelectedBlockDescendantTargets(editorRoot)
    : null;
  let changed = false;
  const labels = layout.labels.map((label, index) => {
    if (incrementalSyncIndexes && !incrementalSyncIndexes.has(index)) {
      return label;
    }

    const target = layout.targets[index];
    const selected = target instanceof HTMLElement
      && editorRoot.contains(target)
      && (
        incrementalSyncIndexes
          ? isInsideSelectedBlockFromCurrentDom(target)
          : isInsideSelectedBlock(target, selectedDescendantTargets)
      );

    if (selected === (label.selected === true)) {
      return label;
    }

    changed = true;
    if (selected) {
      return {
        ...label,
        selected: true,
      };
    }

    return {
      lineNumber: label.lineNumber,
      top: label.top,
      left: label.left,
    };
  });

  return changed
    ? {
        ...layout,
        labels,
      }
    : layout;
}

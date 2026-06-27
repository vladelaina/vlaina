import { useEffect, useState, type RefObject } from 'react';
import {
  resolveBodyLineNumberLabels,
  type BodyLineNumberLabel,
} from '../utils/bodyLineNumberLayout';

const BLOCK_SELECTION_PENDING_CLASS = 'editor-block-selection-pending';
const BLOCK_DRAG_ACTIVE_CLASS = 'editor-block-drag-active';
const DEFERRED_BLOCK_INTERACTION_REFRESH_RETRY_MS = 80;
const POINTER_INTERACTION_REFRESH_FALLBACK_MS = 10_000;
const MAX_OBSERVED_EDITOR_CHILD_RESIZE_TARGETS = 5000;

interface BodyLineNumberGutterProps {
  markdown: string;
  revision: number;
  shellRef: RefObject<HTMLDivElement | null>;
}

export function BodyLineNumberGutter({ markdown, revision, shellRef }: BodyLineNumberGutterProps) {
  const [labels, setLabels] = useState<BodyLineNumberLabel[]>([]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      setLabels([]);
      return;
    }

    const resolvedShell: HTMLDivElement = shell;
    let frameId: number | null = null;
    let deferredBlockInteractionRefreshTimerId: number | null = null;
    let pointerInteractionFallbackTimerId: number | null = null;
    let needsRefreshAfterDeferredBlockInteraction = false;
    let pointerInteractionActive = false;
    const editorRoot = resolvedShell.querySelector<HTMLElement>('.ProseMirror');
    const observedResizeTargets = new Set<Element>();

    function shouldDeferRefreshForBlockInteraction() {
      return editorRoot?.classList.contains(BLOCK_SELECTION_PENDING_CLASS) === true
        || resolvedShell.ownerDocument.body.classList.contains(BLOCK_DRAG_ACTIVE_CLASS)
        || pointerInteractionActive;
    }

    function clearDeferredBlockInteractionRefresh() {
      if (deferredBlockInteractionRefreshTimerId === null) {
        return;
      }
      window.clearTimeout(deferredBlockInteractionRefreshTimerId);
      deferredBlockInteractionRefreshTimerId = null;
    }

    function clearPointerInteractionFallback() {
      if (pointerInteractionFallbackTimerId === null) {
        return;
      }
      window.clearTimeout(pointerInteractionFallbackTimerId);
      pointerInteractionFallbackTimerId = null;
    }

    function scheduleRefreshAfterDeferredBlockInteraction() {
      needsRefreshAfterDeferredBlockInteraction = true;
      if (deferredBlockInteractionRefreshTimerId !== null) {
        return;
      }

      deferredBlockInteractionRefreshTimerId = window.setTimeout(() => {
        deferredBlockInteractionRefreshTimerId = null;
        if (shouldDeferRefreshForBlockInteraction()) {
          scheduleRefreshAfterDeferredBlockInteraction();
          return;
        }
        if (!needsRefreshAfterDeferredBlockInteraction) {
          return;
        }
        needsRefreshAfterDeferredBlockInteraction = false;
        refresh();
      }, DEFERRED_BLOCK_INTERACTION_REFRESH_RETRY_MS);
    }

    function handlePointerInteractionStart() {
      pointerInteractionActive = true;
      clearPointerInteractionFallback();
      pointerInteractionFallbackTimerId = window.setTimeout(() => {
        pointerInteractionFallbackTimerId = null;
        handlePointerInteractionEnd();
      }, POINTER_INTERACTION_REFRESH_FALLBACK_MS);
    }

    function handlePointerInteractionEnd() {
      if (!pointerInteractionActive) {
        clearPointerInteractionFallback();
        return;
      }
      pointerInteractionActive = false;
      clearPointerInteractionFallback();
      if (needsRefreshAfterDeferredBlockInteraction) {
        scheduleRefreshAfterDeferredBlockInteraction();
      }
    }

    function refresh() {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        frameId = null;
        if (shouldDeferRefreshForBlockInteraction()) {
          scheduleRefreshAfterDeferredBlockInteraction();
          return;
        }
        needsRefreshAfterDeferredBlockInteraction = false;
        clearDeferredBlockInteractionRefresh();
        setLabels(resolveBodyLineNumberLabels(resolvedShell, markdown));
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      syncObservedResizeTargets();
      refresh();
    });

    function shouldRefreshForMutation(records: MutationRecord[]) {
      for (const record of records) {
        if (!(record.target instanceof Element)) {
          return true;
        }

        const atomicEditorBlock = record.target.closest('.code-block-container, .frontmatter-block-container');
        if (atomicEditorBlock && atomicEditorBlock !== record.target) {
          continue;
        }

        return true;
      }

      return false;
    }

    function syncObservedResizeTargets() {
      const nextTargets = new Set<Element>([resolvedShell]);
      if (editorRoot) {
        nextTargets.add(editorRoot);
        for (
          let index = 0;
          index < editorRoot.children.length && index < MAX_OBSERVED_EDITOR_CHILD_RESIZE_TARGETS;
          index += 1
        ) {
          const child = editorRoot.children.item(index);
          if (child) nextTargets.add(child);
        }
      }

      for (const target of observedResizeTargets) {
        if (!nextTargets.has(target)) {
          resizeObserver.unobserve(target);
          observedResizeTargets.delete(target);
        }
      }

      for (const target of nextTargets) {
        if (!observedResizeTargets.has(target)) {
          resizeObserver.observe(target);
          observedResizeTargets.add(target);
        }
      }
    }

    syncObservedResizeTargets();
    refresh();

    const mutationObserver = new MutationObserver((records) => {
      if (!shouldRefreshForMutation(records)) {
        return;
      }
      syncObservedResizeTargets();
      refresh();
    });
    if (editorRoot) {
      mutationObserver.observe(editorRoot, {
        attributes: true,
        attributeFilter: ['class', 'data-type', 'data-value', 'style'],
        childList: true,
        subtree: true,
      });
    }

    window.addEventListener('resize', refresh);
    window.addEventListener('pointerdown', handlePointerInteractionStart, true);
    window.addEventListener('pointerup', handlePointerInteractionEnd, true);
    window.addEventListener('pointercancel', handlePointerInteractionEnd, true);
    window.addEventListener('mousedown', handlePointerInteractionStart, true);
    window.addEventListener('mouseup', handlePointerInteractionEnd, true);
    window.addEventListener('blur', handlePointerInteractionEnd);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      clearDeferredBlockInteractionRefresh();
      clearPointerInteractionFallback();
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', refresh);
      window.removeEventListener('pointerdown', handlePointerInteractionStart, true);
      window.removeEventListener('pointerup', handlePointerInteractionEnd, true);
      window.removeEventListener('pointercancel', handlePointerInteractionEnd, true);
      window.removeEventListener('mousedown', handlePointerInteractionStart, true);
      window.removeEventListener('mouseup', handlePointerInteractionEnd, true);
      window.removeEventListener('blur', handlePointerInteractionEnd);
    };
  }, [markdown, revision, shellRef]);

  return (
    <div className="body-line-number-gutter" aria-hidden="true">
      {labels.map((label, index) => (
        <span
          key={`${label.lineNumber}-${index}`}
          className="body-line-number"
          style={{
            left: label.left,
            top: label.top,
          }}
        >
          {label.lineNumber}
        </span>
      ))}
    </div>
  );
}

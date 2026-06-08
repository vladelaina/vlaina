import { useEffect, useState, type RefObject } from 'react';
import { getMarkdownBodySourceLineNumbers } from '../utils/bodyLineNumbers';

const BODY_LINE_NUMBER_LABEL_WIDTH = 40;
const BODY_LINE_NUMBER_LABEL_GAP = 18;
export const MAX_BODY_LINE_NUMBER_TARGETS = 5000;
export const MAX_BODY_LINE_NUMBER_LIST_SCAN_ELEMENTS = 10000;
export const MAX_BODY_LINE_NUMBER_SELECTION_SCAN_ELEMENTS = 20000;

interface BodyLineNumberGutterProps {
  markdown: string;
  revision: number;
  shellRef: RefObject<HTMLDivElement | null>;
}

interface BodyLineNumberLabel {
  lineNumber: number;
  top: number;
  left: number;
}

export function collectBodyLineNumberTargets(editorRoot: HTMLElement): HTMLElement[] {
  const targets: HTMLElement[] = [];

  for (let index = 0; index < editorRoot.children.length && targets.length < MAX_BODY_LINE_NUMBER_TARGETS; index += 1) {
    const child = editorRoot.children.item(index);
    if (!(child instanceof HTMLElement)) continue;
    if (child.classList.contains('code-block-container')) continue;
    if (child.classList.contains('frontmatter-block-container')) continue;

    const tagName = child.tagName.toLowerCase();
    if (tagName === 'ul' || tagName === 'ol') {
      const walker = child.ownerDocument.createTreeWalker(child, NodeFilter.SHOW_ELEMENT);
      let scanned = 0;
      for (
        let node = walker.nextNode();
        node && targets.length < MAX_BODY_LINE_NUMBER_TARGETS && scanned < MAX_BODY_LINE_NUMBER_LIST_SCAN_ELEMENTS;
        node = walker.nextNode()
      ) {
        scanned += 1;
        if (
          node instanceof HTMLElement &&
          node.tagName.toLowerCase() === 'li' &&
          !node.closest('.code-block-container, .frontmatter-block-container')
        ) {
          targets.push(node);
        }
      }
      continue;
    }

    targets.push(child);
  }

  return targets;
}

function collectSelectedBlockDescendantTargets(editorRoot: HTMLElement): WeakSet<HTMLElement> {
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

function isInsideSelectedBlock(target: HTMLElement, selectedDescendantTargets: WeakSet<HTMLElement>): boolean {
  return target.classList.contains('editor-block-selected')
    || target.closest('.editor-block-selected') !== null
    || selectedDescendantTargets.has(target);
}

export function resolveBodyLineNumberLabels(shell: HTMLElement, markdown: string): BodyLineNumberLabel[] {
  const editorRoot = shell.querySelector<HTMLElement>('.ProseMirror');
  if (!editorRoot) return [];

  const sourceLineNumbers = getMarkdownBodySourceLineNumbers(markdown);
  const targets = collectBodyLineNumberTargets(editorRoot);
  const selectedDescendantTargets = collectSelectedBlockDescendantTargets(editorRoot);
  const shellRect = shell.getBoundingClientRect();
  const editorRect = editorRoot.getBoundingClientRect();
  const left = Math.max(
    0,
    editorRect.left - shellRect.left - BODY_LINE_NUMBER_LABEL_GAP - BODY_LINE_NUMBER_LABEL_WIDTH
  );

  return targets
    .slice(0, sourceLineNumbers.length)
    .map((target, index) => ({ target, lineNumber: sourceLineNumbers[index] }))
    .filter(({ target }) => !isInsideSelectedBlock(target, selectedDescendantTargets))
    .map(({ target, lineNumber }) => {
      const targetRect = target.getBoundingClientRect();
      return {
        lineNumber,
        top: targetRect.top - shellRect.top + targetRect.height / 2,
        left,
      };
    });
}

export function BodyLineNumberGutter({ markdown, revision, shellRef }: BodyLineNumberGutterProps) {
  const [labels, setLabels] = useState<BodyLineNumberLabel[]>([]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      setLabels([]);
      return;
    }

    let frameId: number | null = null;

    const refresh = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        frameId = null;
        setLabels(resolveBodyLineNumberLabels(shell, markdown));
      });
    };

    refresh();

    const editorRoot = shell.querySelector<HTMLElement>('.ProseMirror');
    const resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(shell);
    if (editorRoot) {
      resizeObserver.observe(editorRoot);
    }

    const mutationObserver = new MutationObserver(refresh);
    if (editorRoot) {
      mutationObserver.observe(editorRoot, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    window.addEventListener('resize', refresh);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', refresh);
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

import { useEffect, useState, type RefObject } from 'react';
import { getMarkdownBodySourceLineNumbers } from '../utils/bodyLineNumbers';

const BODY_LINE_NUMBER_LABEL_WIDTH = 40;
const BODY_LINE_NUMBER_LABEL_GAP = 18;

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

  for (const child of Array.from(editorRoot.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.classList.contains('code-block-container')) continue;
    if (child.classList.contains('frontmatter-block-container')) continue;

    const tagName = child.tagName.toLowerCase();
    if (tagName === 'ul' || tagName === 'ol') {
      targets.push(
        ...Array.from(child.querySelectorAll<HTMLElement>('li')).filter((item) =>
          !item.closest('.code-block-container, .frontmatter-block-container')
        )
      );
      continue;
    }

    targets.push(child);
  }

  return targets;
}

function isInsideSelectedBlock(target: HTMLElement): boolean {
  return target.classList.contains('editor-block-selected')
    || target.closest('.editor-block-selected') !== null
    || target.querySelector('.editor-block-selected') !== null;
}

export function resolveBodyLineNumberLabels(shell: HTMLElement, markdown: string): BodyLineNumberLabel[] {
  const editorRoot = shell.querySelector<HTMLElement>('.ProseMirror');
  if (!editorRoot) return [];

  const sourceLineNumbers = getMarkdownBodySourceLineNumbers(markdown);
  const targets = collectBodyLineNumberTargets(editorRoot);
  const shellRect = shell.getBoundingClientRect();
  const editorRect = editorRoot.getBoundingClientRect();
  const left = Math.max(
    0,
    editorRect.left - shellRect.left - BODY_LINE_NUMBER_LABEL_GAP - BODY_LINE_NUMBER_LABEL_WIDTH
  );

  return targets
    .slice(0, sourceLineNumbers.length)
    .map((target, index) => ({ target, lineNumber: sourceLineNumbers[index] }))
    .filter(({ target }) => !isInsideSelectedBlock(target))
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

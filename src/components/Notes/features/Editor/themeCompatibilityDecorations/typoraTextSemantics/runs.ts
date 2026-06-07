import { hasAnyMark, hasMark, VLOOK_HIGHLIGHT_MARKS } from './marks';
import type { InlineTextRun } from './types';

export function getInlineTextRuns(node: any, pos: number): InlineTextRun[] {
  const runs: InlineTextRun[] = [];
  if (!node.isTextblock || typeof node.forEach !== 'function') {
    return runs;
  }

  node.forEach((child: any, offset: number) => {
    if (!child.isText || typeof child.nodeSize !== 'number') return;
    const from = pos + 1 + offset;
    const to = from + child.nodeSize;
    runs.push({
      from,
      to,
      text: child.text ?? '',
      hasEmphasis: hasMark(child, 'emphasis'),
      hasInlineCode: hasMark(child, 'inlineCode'),
      hasStrong: hasMark(child, 'strong'),
      hasSubscript: hasMark(child, 'subscript'),
      hasSuperscript: hasMark(child, 'superscript'),
      hasUnderline: hasMark(child, 'underline'),
      hasVlookHighlight: hasAnyMark(child, VLOOK_HIGHLIGHT_MARKS),
    });
  });

  return runs;
}

export function getTextContent(node: any): string {
  return typeof node.textContent === 'string' ? node.textContent : '';
}

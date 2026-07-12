import {
  getCombinedClass,
  getInlineTextRuns,
  getTextBlockVlookKind,
  type DecorationAttrs,
} from '../typoraTextSemantics';
import { htmlBlockContainsMedia } from './htmlBlocks';
import {
  getNextContentSibling,
  getNextContentSiblingEntry,
  getPreviousContentSiblingEntry,
  isIgnorableVlookLayoutSibling,
} from './shared';

function getVlookCaptionContextClass(parent: any, index: number | undefined): string | null {
  const nextSibling = getNextContentSibling(parent, index);
  return getVlookCaptionTargetContextClass(nextSibling);
}

function getVlookCaptionTargetContextClass(node: any): string | null {
  const nodeType = node?.type?.name;
  if (nodeType === 'table') return 'table';
  if (nodeType === 'code_block') return 'codeblock';
  if (nodeType === 'math_block') return 'formula';
  if (nodeType === 'html_block' && htmlBlockContainsMedia(node)) return 'iframe';
  if (nodeType === 'mermaid' || nodeType === 'mermaid_block') return 'mermaid';
  return null;
}

function isVlookCaptionParagraph(node: any): boolean {
  if (node?.type?.name !== 'paragraph') return false;
  return getTextBlockVlookKind(node, getInlineTextRuns(node, 0)) === 'caption';
}

export function getVlookCaptionTargetAttrs(
  node: any,
  parent: any,
  index: number | undefined
): DecorationAttrs | null {
  const contextClass = getVlookCaptionTargetContextClass(node);
  if (!contextClass) return null;

  const previous = getPreviousContentSiblingEntry(parent, index);
  if (!previous || !isVlookCaptionParagraph(previous.node)) return null;

  return {
    class: `vlook-caption-target vlook-caption-target-${contextClass}`,
  };
}

export function getVlookCaptionGapAttrs(
  node: any,
  parent: any,
  index: number | undefined
): DecorationAttrs | null {
  if (!isIgnorableVlookLayoutSibling(node)) return null;

  const previous = getPreviousContentSiblingEntry(parent, index);
  const next = getNextContentSiblingEntry(parent, index);
  if (
    previous &&
    next &&
    isVlookCaptionParagraph(previous.node) &&
    getVlookCaptionTargetContextClass(next.node)
  ) {
    return { class: 'vlook-caption-gap' };
  }

  return null;
}

export function getVlookParagraphAttrs(
  node: any,
  pos: number,
  parent: any,
  index: number | undefined
): DecorationAttrs | null {
  const runs = getInlineTextRuns(node, pos);
  const textBlockKind = getTextBlockVlookKind(node, runs);
  if (textBlockKind === 'caption') {
    const classes = ['v-caption', 'vlook-caption-block'];
    const contextClass = getVlookCaptionContextClass(parent, index);
    if (contextClass) classes.push(contextClass);
    if (node.attrs?.align === 'center') classes.push('v-cap-cntr');
    return { class: classes.join(' ') };
  }
  if (textBlockKind === 'tab-caption') {
    return { class: 'vlook-tab-caption' };
  }
  if (textBlockKind === 'highlight') {
    return { class: 'vlook-highlight-block' };
  }
  if (textBlockKind === 'emphasis') {
    return { class: 'vlook-emphasis-block' };
  }
  if (textBlockKind === 'strong') {
    return { class: 'vlook-strong-block' };
  }
  if (textBlockKind === 'underline') {
    return { class: 'vlook-underline-block' };
  }

  const hasSuperscript = runs.some((run) => run.hasSuperscript);
  const hasSubscript = runs.some((run) => run.hasSubscript);
  if (hasSuperscript || hasSubscript) {
    return {
      class: getCombinedClass(
        hasSuperscript ? 'vlook-sup-line' : null,
        hasSubscript ? 'vlook-sub-line' : null
      ),
    };
  }

  return null;
}

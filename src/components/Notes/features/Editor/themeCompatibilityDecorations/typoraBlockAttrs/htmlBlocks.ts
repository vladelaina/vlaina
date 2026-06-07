import {
  hasMark,
  type DecorationAttrs,
} from '../typoraTextSemantics';

export function htmlBlockContainsMedia(node: any): boolean {
  const value = typeof node.attrs?.value === 'string' ? node.attrs.value : '';
  return /<(?:iframe|video|object|embed)\b/i.test(value);
}

function htmlBlockContainsVlookPageBreak(node: any): boolean {
  const value = typeof node.attrs?.value === 'string' ? node.attrs.value : '';
  return /\bclass\s*=\s*(?:"[^"]*\bv-page-break\b[^"]*"|'[^']*\bv-page-break\b[^']*')/i.test(value);
}

export function getInlineHtmlAttrs(node: any): DecorationAttrs | null {
  if (node.type?.name !== 'html') return null;
  const value = typeof node.attrs?.value === 'string' ? node.attrs.value : '';
  const classes: string[] = [];

  if (/<kbd\b/i.test(value)) {
    classes.push('vlook-inline-html', 'vlook-kbd-html');
    if (hasMark(node, 'link')) {
      classes.push('v-btn');
    }
  }

  return classes.length > 0 ? { class: classes.join(' ') } : null;
}

export function getHtmlBlockAttrs(node: any): DecorationAttrs | null {
  if (node.type?.name !== 'html_block') {
    return null;
  }
  if (htmlBlockContainsMedia(node)) {
    return { class: 'v-caption iframe vlook-media-html-block' };
  }
  if (htmlBlockContainsVlookPageBreak(node)) {
    return { class: 'v-page-break vlook-page-break' };
  }
  return null;
}

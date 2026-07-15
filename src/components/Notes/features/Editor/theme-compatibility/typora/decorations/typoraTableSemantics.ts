import { Decoration } from '@milkdown/kit/prose/view';
import {
  VLOOK_HIGHLIGHT_MARKS,
  everyTextNodeHasAnyMark,
  everyTextNodeHasMark,
  getTextContent,
  nodeHasAnyMark,
  pushTyporaInlineAttrs,
  pushTyporaInlineClass,
  textNodeHasMark,
  type DecorationAttrs,
} from './typoraTextSemantics';

const VLOOK_LONG_TABLE_CELL_TEXT_LENGTH = 36;

function isVlookTableCheckboxText(text: string): string | null {
  const normalized = text.trim().toLowerCase();
  if (/^(?:\[[ x-]\]|[-+*]\s+\[[ x-]\])$/.test(normalized)) {
    if (normalized.includes('x')) return 'checked';
    if (normalized.includes('-')) return 'pending';
    return 'unchecked';
  }
  if (/^(?:true|yes|y|done|checked|ok|pass|passed)$/.test(normalized)) return 'checked';
  if (/^(?:false|no|n|todo|unchecked|fail|failed)$/.test(normalized)) return 'failed';
  return null;
}

export function getTableAttrs(node: any): DecorationAttrs | null {
  if (node.type?.name !== 'table') return null;
  const classes = ['table-figure'];
  const firstRow = node.firstChild;
  const firstCell = firstRow?.firstChild;
  if (firstCell && everyTextNodeHasMark(firstCell, 'strong')) {
    classes.push('v-freeze', 'auto');
  }
  return { class: classes.join(' ') };
}

export function getTableCellAttrs(node: any): DecorationAttrs | null {
  if (node.type?.name !== 'table_cell' && node.type?.name !== 'table_header') return null;

  const text = getTextContent(node).trim();
  const classes: string[] = [];
  if (!text) {
    classes.push('v-empty-cell');
  }
  if (textNodeHasMark(node, 'strong')) {
    classes.push('v-tbl-col-fmt-bold');
  }
  if (textNodeHasMark(node, 'emphasis')) {
    classes.push('v-tbl-col-fmt-em');
  }
  if (nodeHasAnyMark(node, VLOOK_HIGHLIGHT_MARKS)) {
    classes.push('v-tbl-col-fmt-mark');
  }
  if (textNodeHasMark(node, 'emphasis') && nodeHasAnyMark(node, VLOOK_HIGHLIGHT_MARKS)) {
    classes.push('td-span');
  }
  if (text.length >= VLOOK_LONG_TABLE_CELL_TEXT_LENGTH || /\n/.test(getTextContent(node))) {
    classes.push('v-long');
  }
  if (
    nodeHasAnyMark(node, VLOOK_HIGHLIGHT_MARKS) &&
    everyTextNodeHasAnyMark(node, VLOOK_HIGHLIGHT_MARKS)
  ) {
    classes.push('v-table-colspan-all');
  }

  const checkboxState = node.type?.name === 'table_cell'
    ? isVlookTableCheckboxText(text)
    : null;
  if (checkboxState) {
    classes.push('v-tbl-col-fmt-chkbox');
  }

  const numericText = text.replace(/[$¥€£,%％\s]/g, '');
  if (/^[+-]?(?:\d+|\d*\.\d+)$/.test(numericText)) {
    classes.push('v-tbl-col-fmt-num');
    if (numericText.startsWith('-')) classes.push('v-tbl-col-fmt-num-negative');
    if (numericText.startsWith('+') || (!numericText.startsWith('-') && Number(numericText) > 0)) {
      classes.push('v-tbl-col-fmt-num-positive');
    }
  }

  const attrs: DecorationAttrs = {};
  if (classes.length > 0) attrs.class = classes.join(' ');
  if (checkboxState) attrs['data-vlook-checkbox'] = checkboxState;
  return Object.keys(attrs).length > 0 ? attrs : null;
}

function pushTextMatchesAsInlineClass(
  decorations: Decoration[],
  textStart: number,
  text: string,
  pattern: RegExp,
  className: string
) {
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? -1;
    if (index < 0) continue;
    pushTyporaInlineClass(
      decorations,
      textStart + index,
      textStart + index + match[0].length,
      className
    );
  }
}

export function addTyporaTableInlineDecorations(
  decorations: Decoration[],
  node: any,
  pos: number
) {
  if (node.type?.name !== 'table_cell' && node.type?.name !== 'table_header') return;

  const checkboxState = node.type?.name === 'table_cell'
    ? isVlookTableCheckboxText(getTextContent(node))
    : null;

  node.descendants?.((child: any, childPos: number) => {
    if (!child.isText) return true;

    const text = child.text ?? '';
    const textStart = pos + 1 + childPos;

    if (checkboxState) {
      const trimmed = text.trim();
      const checkboxTextStart = trimmed ? text.indexOf(trimmed) : -1;
      if (checkboxTextStart >= 0 && isVlookTableCheckboxText(trimmed) === checkboxState) {
        pushTyporaInlineAttrs(
          decorations,
          textStart + checkboxTextStart,
          textStart + checkboxTextStart + trimmed.length,
          {
            class: 'v-svg-input-checkbox',
            'data-vlook-checkbox': checkboxState,
          }
        );
      }
    }

    pushTextMatchesAsInlineClass(
      decorations,
      textStart,
      text,
      /[$¥€£]/g,
      'v-tbl-col-fmt-currency'
    );
    pushTextMatchesAsInlineClass(
      decorations,
      textStart,
      text,
      /[％%]/g,
      'v-tbl-col-fmt-percent'
    );
    pushTextMatchesAsInlineClass(
      decorations,
      textStart,
      text,
      /\.\d+/g,
      'v-tbl-col-fmt-num-decimal'
    );

    return true;
  });
}

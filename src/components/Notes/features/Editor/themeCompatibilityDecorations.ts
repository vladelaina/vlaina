import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

function getTaskListItemAttrs(node: any): Record<string, string> | null {
  if (node.type?.name !== 'list_item' || typeof node.attrs?.checked !== 'boolean') {
    return null;
  }

  const checked = node.attrs.checked;
  return {
    class: [
      'HyperMD-list-line',
      'cm-line',
      'md-task-list-item',
      'task-list-item',
      'HyperMD-task-line',
      checked ? 'is-checked' : '',
    ].filter(Boolean).join(' '),
    'data-task': checked ? 'x' : ' ',
    'aria-checked': String(checked),
  };
}

function getListItemAttrs(node: any): Record<string, string> | null {
  if (node.type?.name !== 'list_item' || typeof node.attrs?.checked === 'boolean') {
    return null;
  }

  return {
    class: 'HyperMD-list-line cm-line',
  };
}

function listContainsTaskItems(node: any): boolean {
  let containsTask = false;
  node.descendants?.((child: any) => {
    if (child.type?.name === 'list_item' && typeof child.attrs?.checked === 'boolean') {
      containsTask = true;
      return false;
    }
    return true;
  });
  return containsTask;
}

function getListAttrs(node: any): Record<string, string> | null {
  const classes: string[] = [];

  if (node.type?.name === 'bullet_list') {
    classes.push('has-list-bullet');
    if (listContainsTaskItems(node)) {
      classes.push('contains-task-list');
    }
    return { class: classes.join(' ') };
  }

  if (node.type?.name === 'ordered_list' && listContainsTaskItems(node)) {
    return { class: 'contains-task-list' };
  }

  return null;
}

function getFirstBlockAttrs(node: any, index: number | undefined): Record<string, string> | null {
  if (index !== 0) return null;
  if (
    node.type?.name !== 'paragraph' &&
    node.type?.name !== 'bullet_list' &&
    node.type?.name !== 'ordered_list'
  ) {
    return null;
  }

  return { class: 'first-p' };
}

function hasMark(node: any, markName: string): boolean {
  return Array.isArray(node.marks) && node.marks.some((mark: any) => mark.type?.name === markName);
}

function hasAnyMark(node: any, markNames: readonly string[]): boolean {
  return markNames.some((markName) => hasMark(node, markName));
}

interface InlineTextRun {
  from: number;
  to: number;
  text: string;
  hasEmphasis: boolean;
  hasInlineCode: boolean;
  hasStrong: boolean;
  hasSubscript: boolean;
  hasSuperscript: boolean;
  hasVlookHighlight: boolean;
}

interface EmphasisRun {
  from: number;
  to: number;
  hasInlineCode: boolean;
  hasPlainText: boolean;
  hasStrong: boolean;
  text: string;
  inlineCodeRanges: Array<{ from: number; to: number }>;
  highlightRanges: Array<{ from: number; to: number }>;
}

const VLOOK_HIGHLIGHT_MARKS = ['highlight', 'bgColor'] as const;
const VLOOK_ACCENT_TOKENS = [
  'wn',
  'rd',
  'og',
  'tu',
  'ye',
  'lm',
  'gn',
  'mn',
  'ol',
  'aq',
  'sk',
  'cy',
  'bu',
  'se',
  'la',
  'vn',
  'cf',
  'au',
  'pu',
  'ro',
  'pl',
  'pk',
  'gd',
  'bn',
  'gy',
  'wt',
  'bk',
  't1',
  't2',
] as const;
const VLOOK_ACCENT_TOKEN_SET = new Set<string>(VLOOK_ACCENT_TOKENS);
const VLOOK_LONG_TABLE_CELL_TEXT_LENGTH = 36;

function getInlineTextRuns(node: any, pos: number): InlineTextRun[] {
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
      hasVlookHighlight: hasAnyMark(child, VLOOK_HIGHLIGHT_MARKS),
    });
  });

  return runs;
}

function getTextContent(node: any): string {
  return typeof node.textContent === 'string' ? node.textContent : '';
}

function getVlookAccentToken(text: string): string | null {
  const normalized = text
    .trim()
    .toLowerCase()
    .match(/^(?:[#.[(]\s*)?([a-z][a-z0-9]?)(?=$|[\s:：|/)\]._-])/)?.[1];
  return normalized && VLOOK_ACCENT_TOKEN_SET.has(normalized) ? normalized : null;
}

function getVlookAccentTokenFromNode(node: any): string | null {
  return getVlookAccentToken(getTextContent(node));
}

function getCombinedClass(...classNames: Array<string | null | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}

function isEveryTextRun(
  runs: InlineTextRun[],
  predicate: (run: InlineTextRun) => boolean
): boolean {
  return runs.length > 0 && runs.every((run) => run.text.trim() === '' || predicate(run));
}

function getTextBlockVlookKind(node: any, runs: InlineTextRun[]): 'caption' | 'highlight' | 'emphasis' | null {
  if (node.type?.name !== 'paragraph' || runs.length === 0 || getTextContent(node).trim() === '') {
    return null;
  }

  if (isEveryTextRun(runs, (run) => run.hasEmphasis && run.hasVlookHighlight)) {
    return 'caption';
  }

  if (isEveryTextRun(runs, (run) => run.hasVlookHighlight && !run.hasEmphasis && !run.hasInlineCode)) {
    return 'highlight';
  }

  if (isEveryTextRun(runs, (run) => run.hasEmphasis && !run.hasInlineCode && !run.hasStrong && !run.hasVlookHighlight)) {
    return 'emphasis';
  }

  return null;
}

function pushTyporaInlineClass(
  decorations: Decoration[],
  from: number,
  to: number,
  className: string
) {
  if (to <= from) return;
  decorations.push(Decoration.inline(from, to, { class: className }));
}

function pushTyporaInlineAttrs(
  decorations: Decoration[],
  from: number,
  to: number,
  attrs: Record<string, string>
) {
  if (to <= from) return;
  decorations.push(Decoration.inline(from, to, attrs));
}

function pushEmphasisRunDecorations(decorations: Decoration[], run: EmphasisRun | null) {
  if (!run) return;
  const accentToken = getVlookAccentToken(run.text);
  const hasMultipleInlineCodeRanges = run.inlineCodeRanges.length > 1;

  if (run.hasStrong) {
    pushTyporaInlineClass(decorations, run.from, run.to, getCombinedClass('v-coating', accentToken, 'em'));
  }

  for (const range of run.highlightRanges) {
    pushTyporaInlineClass(decorations, range.from, range.to, getCombinedClass('v-stepwise', accentToken));
  }

  if (!run.hasInlineCode) return;

  if (run.hasPlainText) {
    pushTyporaInlineClass(decorations, run.from, run.to, getCombinedClass('v-badge-name', accentToken, hasMultipleInlineCodeRanges ? 'hastwo' : null));
    for (const range of run.inlineCodeRanges) {
      pushTyporaInlineClass(decorations, range.from, range.to, getCombinedClass('v-badge-value', hasMultipleInlineCodeRanges ? 'hastwo' : null));
    }
    return;
  }

  for (const range of run.inlineCodeRanges) {
    pushTyporaInlineClass(decorations, range.from, range.to, getCombinedClass('v-tag', accentToken, 'em'));
  }
}

function addTyporaInlineDecorations(decorations: Decoration[], node: any, pos: number) {
  const runs = getInlineTextRuns(node, pos);
  const textBlockKind = getTextBlockVlookKind(node, runs);
  if (textBlockKind === 'caption') {
    const first = runs[0];
    const last = runs[runs.length - 1];
    pushTyporaInlineClass(decorations, first.from, last.to, 'v-cap-1');
    return;
  }

  if (textBlockKind === 'highlight' || textBlockKind === 'emphasis') {
    return;
  }

  let emphasisRun: EmphasisRun | null = null;

  const flush = () => {
    pushEmphasisRunDecorations(decorations, emphasisRun);
    emphasisRun = null;
  };

  for (const run of runs) {
    if (!run.hasEmphasis) {
      flush();
      continue;
    }

    if (!emphasisRun || emphasisRun.to !== run.from) {
      flush();
      emphasisRun = {
        from: run.from,
        to: run.to,
        hasInlineCode: false,
        hasPlainText: false,
        hasStrong: false,
        text: '',
        inlineCodeRanges: [],
        highlightRanges: [],
      };
    } else {
      emphasisRun.to = run.to;
    }

    emphasisRun.text += run.text;

    if (run.hasInlineCode) {
      emphasisRun.hasInlineCode = true;
      emphasisRun.inlineCodeRanges.push({ from: run.from, to: run.to });
    } else {
      emphasisRun.hasPlainText = true;
    }

    if (run.hasStrong) {
      emphasisRun.hasStrong = true;
    }

    if (run.hasVlookHighlight) {
      emphasisRun.highlightRanges.push({ from: run.from, to: run.to });
    }
  }

  flush();
}

function getVlookParagraphAttrs(node: any, pos: number): Record<string, string> | null {
  const runs = getInlineTextRuns(node, pos);
  const textBlockKind = getTextBlockVlookKind(node, runs);
  if (textBlockKind === 'caption') {
    return { class: 'v-caption vlook-caption-block' };
  }
  if (textBlockKind === 'highlight') {
    return { class: 'vlook-highlight-block' };
  }
  if (textBlockKind === 'emphasis') {
    return { class: 'vlook-emphasis-block' };
  }

  const hasSuperscript = runs.some((run) => run.hasSuperscript);
  const hasSubscript = runs.some((run) => run.hasSubscript);
  if (hasSuperscript || hasSubscript) {
    return { class: getCombinedClass(hasSuperscript ? 'vlook-sup-line' : null, hasSubscript ? 'vlook-sub-line' : null) };
  }

  return null;
}

function getBlockquoteAttrs(node: any): Record<string, string> | null {
  if (node.type?.name !== 'blockquote') return null;
  const accentToken = getVlookAccentTokenFromNode(node);
  const isEmphasized = everyTextNodeHasMark(node, 'emphasis');
  const className = getCombinedClass(accentToken, isEmphasized ? 'em' : null);
  return className ? { class: className } : null;
}

function textNodeHasMark(node: any, markName: string): boolean {
  if (node.isText) return hasMark(node, markName);
  let matched = false;
  node.descendants?.((child: any) => {
    if (child.isText && hasMark(child, markName)) {
      matched = true;
      return false;
    }
    return true;
  });
  return matched;
}

function everyTextNodeHasMark(node: any, markName: string): boolean {
  let sawText = false;
  let allMatched = true;
  node.descendants?.((child: any) => {
    if (!child.isText || child.text === '') return true;
    sawText = true;
    if (!hasMark(child, markName)) {
      allMatched = false;
      return false;
    }
    return true;
  });
  return sawText && allMatched;
}

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

function getTableAttrs(node: any): Record<string, string> | null {
  if (node.type?.name !== 'table') return null;
  const classes = ['table-figure'];
  const firstRow = node.firstChild;
  const firstCell = firstRow?.firstChild;
  if (firstCell && everyTextNodeHasMark(firstCell, 'strong')) {
    classes.push('v-freeze', 'auto');
  }
  return { class: classes.join(' ') };
}

function getTableCellAttrs(node: any): Record<string, string> | null {
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
  if (textNodeHasMark(node, 'highlight') || textNodeHasMark(node, 'bgColor')) {
    classes.push('v-tbl-col-fmt-mark');
  }
  if (textNodeHasMark(node, 'emphasis') && (textNodeHasMark(node, 'highlight') || textNodeHasMark(node, 'bgColor'))) {
    classes.push('td-span');
  }
  if (text.length >= VLOOK_LONG_TABLE_CELL_TEXT_LENGTH || /\n/.test(getTextContent(node))) {
    classes.push('v-long');
  }
  if (textNodeHasMark(node, 'highlight') && everyTextNodeHasMark(node, 'highlight')) {
    classes.push('v-table-colspan-all');
  }

  const checkboxState = node.type?.name === 'table_cell' ? isVlookTableCheckboxText(text) : null;
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

  const attrs: Record<string, string> = {};
  if (classes.length > 0) attrs.class = classes.join(' ');
  if (checkboxState) attrs['data-vlook-checkbox'] = checkboxState;
  return Object.keys(attrs).length > 0 ? attrs : null;
}

function addVlookTableCellInlineDecorations(decorations: Decoration[], node: any, pos: number) {
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

    for (const match of text.matchAll(/[$¥€£]/g)) {
      const index = match.index ?? -1;
      if (index >= 0) {
        pushTyporaInlineClass(decorations, textStart + index, textStart + index + match[0].length, 'v-tbl-col-fmt-currency');
      }
    }

    for (const match of text.matchAll(/[％%]/g)) {
      const index = match.index ?? -1;
      if (index >= 0) {
        pushTyporaInlineClass(decorations, textStart + index, textStart + index + match[0].length, 'v-tbl-col-fmt-percent');
      }
    }

    for (const match of text.matchAll(/\.\d+/g)) {
      const index = match.index ?? -1;
      if (index >= 0) {
        pushTyporaInlineClass(decorations, textStart + index, textStart + index + match[0].length, 'v-tbl-col-fmt-num-decimal');
      }
    }

    return true;
  });
}

function buildCompatibilityDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node: any, pos: number, _parent: any, index: number | undefined) => {
    addTyporaInlineDecorations(decorations, node, pos);
    addVlookTableCellInlineDecorations(decorations, node, pos);

    const firstBlockAttrs = getFirstBlockAttrs(node, index);
    if (firstBlockAttrs) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, firstBlockAttrs));
    }

    const paragraphAttrs = getVlookParagraphAttrs(node, pos);
    if (paragraphAttrs) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, paragraphAttrs));
    }

    const blockquoteAttrs = getBlockquoteAttrs(node);
    if (blockquoteAttrs) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, blockquoteAttrs));
    }

    const tableAttrs = getTableAttrs(node);
    if (tableAttrs) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, tableAttrs));
    }

    const tableCellAttrs = getTableCellAttrs(node);
    if (tableCellAttrs) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, tableCellAttrs));
    }

    const listAttrs = getListAttrs(node);
    if (listAttrs) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, listAttrs));
    }

    const listItemAttrs = getListItemAttrs(node);
    if (listItemAttrs) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, listItemAttrs));
    }

    const taskAttrs = getTaskListItemAttrs(node);
    if (taskAttrs) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, taskAttrs));
    }

    return true;
  });

  return DecorationSet.create(doc, decorations);
}

export const themeCompatibilityDecorationsPlugin = $prose(() => {
  return new Plugin({
    state: {
      init(_config, state) {
        return buildCompatibilityDecorations(state.doc);
      },
      apply(tr, previous, _oldState, newState) {
        if (!tr.docChanged) return previous.map(tr.mapping, tr.doc);
        return buildCompatibilityDecorations(newState.doc);
      },
    },
    props: {
      decorations(state) {
        return this.getState(state) ?? DecorationSet.empty;
      },
    },
  });
});

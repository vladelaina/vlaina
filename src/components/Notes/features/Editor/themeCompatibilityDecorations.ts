import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import {
  DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
  STOP_PROSE_SCAN,
  scanProseDescendants,
} from './plugins/shared/boundedProseNodeScan';

export const MAX_THEME_COMPATIBILITY_DECORATIONS = 5000;
export const MAX_THEME_COMPATIBILITY_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;

function canAddThemeDecoration(decorations: Decoration[]): boolean {
  return decorations.length < MAX_THEME_COMPATIBILITY_DECORATIONS;
}

function pushThemeDecoration(decorations: Decoration[], decoration: Decoration): boolean {
  if (!canAddThemeDecoration(decorations)) {
    return false;
  }

  decorations.push(decoration);
  return canAddThemeDecoration(decorations);
}

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

export function listContainsTaskItems(node: any, cache?: WeakMap<object, boolean>): boolean {
  if (!node || typeof node !== 'object') return false;

  const cached = cache?.get(node);
  if (cached !== undefined) return cached;

  let containsTask = node.type?.name === 'list_item' && typeof node.attrs?.checked === 'boolean';
  if (!containsTask && typeof node.forEach === 'function') {
    node.forEach((child: any) => {
      if (containsTask) return;
      containsTask = listContainsTaskItems(child, cache);
    });
  }

  cache?.set(node, containsTask);
  return containsTask;
}

function getListAttrs(node: any, taskListCache: WeakMap<object, boolean>): Record<string, string> | null {
  const classes: string[] = [];

  if (node.type?.name === 'bullet_list') {
    classes.push('has-list-bullet');
    if (listContainsTaskItems(node, taskListCache)) {
      classes.push('contains-task-list');
    }
    return { class: classes.join(' ') };
  }

  if (node.type?.name === 'ordered_list' && listContainsTaskItems(node, taskListCache)) {
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
const THEME_COMPATIBILITY_SAFE_CONTENT_NODES = new Set(['code_block', 'frontmatter']);

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
): boolean {
  if (to <= from) return canAddThemeDecoration(decorations);
  return pushThemeDecoration(decorations, Decoration.inline(from, to, { class: className }));
}

function pushTyporaInlineAttrs(
  decorations: Decoration[],
  from: number,
  to: number,
  attrs: Record<string, string>
): boolean {
  if (to <= from) return canAddThemeDecoration(decorations);
  return pushThemeDecoration(decorations, Decoration.inline(from, to, attrs));
}

function pushEmphasisRunDecorations(decorations: Decoration[], run: EmphasisRun | null): boolean {
  if (!run) return canAddThemeDecoration(decorations);
  const accentToken = getVlookAccentToken(run.text);
  const hasMultipleInlineCodeRanges = run.inlineCodeRanges.length > 1;

  if (run.hasStrong) {
    if (!pushTyporaInlineClass(decorations, run.from, run.to, getCombinedClass('v-coating', accentToken, 'em'))) {
      return false;
    }
  }

  for (const range of run.highlightRanges) {
    if (!pushTyporaInlineClass(decorations, range.from, range.to, getCombinedClass('v-stepwise', accentToken))) {
      return false;
    }
  }

  if (!run.hasInlineCode) return canAddThemeDecoration(decorations);

  if (run.hasPlainText) {
    if (!pushTyporaInlineClass(decorations, run.from, run.to, getCombinedClass('v-badge-name', accentToken, hasMultipleInlineCodeRanges ? 'hastwo' : null))) {
      return false;
    }
    for (const range of run.inlineCodeRanges) {
      if (!pushTyporaInlineClass(decorations, range.from, range.to, getCombinedClass('v-badge-value', hasMultipleInlineCodeRanges ? 'hastwo' : null))) {
        return false;
      }
    }
    return canAddThemeDecoration(decorations);
  }

  for (const range of run.inlineCodeRanges) {
    if (!pushTyporaInlineClass(decorations, range.from, range.to, getCombinedClass('v-tag', accentToken, 'em'))) {
      return false;
    }
  }

  return canAddThemeDecoration(decorations);
}

function addTyporaInlineDecorations(decorations: Decoration[], node: any, pos: number): boolean {
  const runs = getInlineTextRuns(node, pos);
  const textBlockKind = getTextBlockVlookKind(node, runs);
  if (textBlockKind === 'caption') {
    const first = runs[0];
    const last = runs[runs.length - 1];
    return pushTyporaInlineClass(decorations, first.from, last.to, 'v-cap-1');
  }

  if (textBlockKind === 'highlight' || textBlockKind === 'emphasis') {
    return canAddThemeDecoration(decorations);
  }

  let emphasisRun: EmphasisRun | null = null;

  const flush = () => {
    const canContinue = pushEmphasisRunDecorations(decorations, emphasisRun);
    emphasisRun = null;
    return canContinue;
  };

  for (const run of runs) {
    if (!run.hasEmphasis) {
      if (!flush()) return false;
      continue;
    }

    if (!emphasisRun || emphasisRun.to !== run.from) {
      if (!flush()) return false;
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

  return flush();
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
  scanProseDescendants(node, (child: any) => {
    if (child.isText && hasMark(child, markName)) {
      matched = true;
      return STOP_PROSE_SCAN;
    }
    return true;
  }, MAX_THEME_COMPATIBILITY_DOC_SCAN_NODES);
  return matched;
}

function everyTextNodeHasMark(node: any, markName: string): boolean {
  let sawText = false;
  let allMatched = true;
  const completed = scanProseDescendants(node, (child: any) => {
    if (!child.isText || child.text === '') return true;
    sawText = true;
    if (!hasMark(child, markName)) {
      allMatched = false;
      return STOP_PROSE_SCAN;
    }
    return true;
  }, MAX_THEME_COMPATIBILITY_DOC_SCAN_NODES);
  return completed && sawText && allMatched;
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

function addVlookTableCellInlineDecorations(decorations: Decoration[], node: any, pos: number): boolean {
  if (node.type?.name !== 'table_cell' && node.type?.name !== 'table_header') {
    return canAddThemeDecoration(decorations);
  }

  const checkboxState = node.type?.name === 'table_cell'
    ? isVlookTableCheckboxText(getTextContent(node))
    : null;

  scanProseDescendants(node, (child: any, childPos: number) => {
    if (!child.isText) return true;

    const text = child.text ?? '';
    const textStart = pos + 1 + childPos;

    if (checkboxState) {
      const trimmed = text.trim();
      const checkboxTextStart = trimmed ? text.indexOf(trimmed) : -1;
      if (checkboxTextStart >= 0 && isVlookTableCheckboxText(trimmed) === checkboxState) {
        if (!pushTyporaInlineAttrs(
          decorations,
          textStart + checkboxTextStart,
          textStart + checkboxTextStart + trimmed.length,
          {
            class: 'v-svg-input-checkbox',
            'data-vlook-checkbox': checkboxState,
          }
        )) return STOP_PROSE_SCAN;
      }
    }

    for (const match of text.matchAll(/[$¥€£]/g)) {
      const index = match.index ?? -1;
      if (index >= 0) {
        if (!pushTyporaInlineClass(decorations, textStart + index, textStart + index + match[0].length, 'v-tbl-col-fmt-currency')) {
          return STOP_PROSE_SCAN;
        }
      }
    }

    for (const match of text.matchAll(/[％%]/g)) {
      const index = match.index ?? -1;
      if (index >= 0) {
        if (!pushTyporaInlineClass(decorations, textStart + index, textStart + index + match[0].length, 'v-tbl-col-fmt-percent')) {
          return STOP_PROSE_SCAN;
        }
      }
    }

    for (const match of text.matchAll(/\.\d+/g)) {
      const index = match.index ?? -1;
      if (index >= 0) {
        if (!pushTyporaInlineClass(decorations, textStart + index, textStart + index + match[0].length, 'v-tbl-col-fmt-num-decimal')) {
          return STOP_PROSE_SCAN;
        }
      }
    }

    return true;
  }, MAX_THEME_COMPATIBILITY_DOC_SCAN_NODES);

  return canAddThemeDecoration(decorations);
}

export function buildCompatibilityDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];
  const taskListCache = new WeakMap<object, boolean>();

  scanProseDescendants(doc, (node: any, pos: number, _parent: any, index: number | undefined) => {
    if (!canAddThemeDecoration(decorations)) {
      return STOP_PROSE_SCAN;
    }

    if (!addTyporaInlineDecorations(decorations, node, pos)) return STOP_PROSE_SCAN;
    if (!addVlookTableCellInlineDecorations(decorations, node, pos)) return STOP_PROSE_SCAN;

    const firstBlockAttrs = getFirstBlockAttrs(node, index);
    if (firstBlockAttrs) {
      if (!pushThemeDecoration(decorations, Decoration.node(pos, pos + node.nodeSize, firstBlockAttrs))) return STOP_PROSE_SCAN;
    }

    const paragraphAttrs = getVlookParagraphAttrs(node, pos);
    if (paragraphAttrs) {
      if (!pushThemeDecoration(decorations, Decoration.node(pos, pos + node.nodeSize, paragraphAttrs))) return STOP_PROSE_SCAN;
    }

    const blockquoteAttrs = getBlockquoteAttrs(node);
    if (blockquoteAttrs) {
      if (!pushThemeDecoration(decorations, Decoration.node(pos, pos + node.nodeSize, blockquoteAttrs))) return STOP_PROSE_SCAN;
    }

    const tableAttrs = getTableAttrs(node);
    if (tableAttrs) {
      if (!pushThemeDecoration(decorations, Decoration.node(pos, pos + node.nodeSize, tableAttrs))) return STOP_PROSE_SCAN;
    }

    const tableCellAttrs = getTableCellAttrs(node);
    if (tableCellAttrs) {
      if (!pushThemeDecoration(decorations, Decoration.node(pos, pos + node.nodeSize, tableCellAttrs))) return STOP_PROSE_SCAN;
    }

    const listAttrs = getListAttrs(node, taskListCache);
    if (listAttrs) {
      if (!pushThemeDecoration(decorations, Decoration.node(pos, pos + node.nodeSize, listAttrs))) return STOP_PROSE_SCAN;
    }

    const listItemAttrs = getListItemAttrs(node);
    if (listItemAttrs) {
      if (!pushThemeDecoration(decorations, Decoration.node(pos, pos + node.nodeSize, listItemAttrs))) return STOP_PROSE_SCAN;
    }

    const taskAttrs = getTaskListItemAttrs(node);
    if (taskAttrs) {
      if (!pushThemeDecoration(decorations, Decoration.node(pos, pos + node.nodeSize, taskAttrs))) return STOP_PROSE_SCAN;
    }

    return true;
  }, MAX_THEME_COMPATIBILITY_DOC_SCAN_NODES);

  return DecorationSet.create(doc, decorations);
}

function rangeIsInsideThemeCompatibilitySafeContent(doc: ProseNode, from: number, to: number): boolean {
  const start = Math.max(0, Math.min(from, doc.content.size));
  const end = Math.max(start, Math.min(to, doc.content.size));
  const $start = doc.resolve(start);

  for (let depth = $start.depth; depth > 0; depth -= 1) {
    const node = $start.node(depth);
    if (!THEME_COMPATIBILITY_SAFE_CONTENT_NODES.has(node.type.name)) {
      continue;
    }

    const contentStart = $start.before(depth) + 1;
    const contentEnd = $start.after(depth) - 1;
    return start >= contentStart && end <= contentEnd;
  }

  return false;
}

export function docChangeMayAffectThemeCompatibilityDecorations(prevDoc: ProseNode, nextDoc: ProseNode): boolean {
  const diffStart = prevDoc.content.findDiffStart(nextDoc.content);
  if (diffStart === null) return false;

  const diffEnd = prevDoc.content.findDiffEnd(nextDoc.content);
  if (!diffEnd) return true;

  return !(
    rangeIsInsideThemeCompatibilitySafeContent(prevDoc, diffStart, diffEnd.a) &&
    rangeIsInsideThemeCompatibilitySafeContent(nextDoc, diffStart, diffEnd.b)
  );
}

export const themeCompatibilityDecorationsPlugin = $prose(() => {
  return new Plugin({
    state: {
      init(_config, state) {
        return buildCompatibilityDecorations(state.doc);
      },
      apply(tr, previous, _oldState, newState) {
        if (!tr.docChanged) return previous.map(tr.mapping, tr.doc);
        if (!docChangeMayAffectThemeCompatibilityDecorations(_oldState.doc, newState.doc)) {
          return previous.map(tr.mapping, newState.doc);
        }
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

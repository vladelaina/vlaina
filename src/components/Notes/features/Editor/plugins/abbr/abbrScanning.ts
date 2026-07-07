import {
  appendBoundedAbbrDefinitions,
  createAbbrUsagePattern,
  extractAbbrDefinitionsFromText,
  type AbbrDefinition,
} from '@/components/common/markdown/abbrMarkdown';
import {
  DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
  STOP_PROSE_SCAN,
  scanProseDescendants,
  type BoundedProseScanNode,
} from '../shared/boundedProseNodeScan';

const SKIPPED_TEXT_PARENT_TYPES = new Set(['code_block', 'html_block']);
const SKIPPED_MARK_TYPES = new Set(['inlineCode', 'code']);
export const MAX_ABBR_TITLE_CHARS = 4096;
export const MAX_ABBR_DECORATIONS = 1000;
export const MAX_ABBR_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_ABBR_UPDATE_RANGE_SCAN_NODES = MAX_ABBR_DOC_SCAN_NODES;
export const MAX_ABBR_TEXT_SCAN_CHARS = 100_000;
export const MAX_ABBR_CHANGED_CONTEXT_CHARS = 512;

export function normalizeAbbrTitle(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_ABBR_TITLE_CHARS) : '';
}

function shouldSkipTextNode(node: BoundedProseScanNode, parent: BoundedProseScanNode): boolean {
  const parentType = parent.type?.name;
  if (parentType && SKIPPED_TEXT_PARENT_TYPES.has(parentType)) {
    return true;
  }

  if (parent?.attrs?.vlainaEscapedBlockSyntax === 'abbrDefinition') {
    return true;
  }

  return node.marks?.some((mark: any) => SKIPPED_MARK_TYPES.has(mark.type?.name)) ?? false;
}

export function extractAbbrDefinitions(
  doc: BoundedProseScanNode,
  maxNodes = MAX_ABBR_DOC_SCAN_NODES,
): AbbrDefinition[] {
  const definitions: AbbrDefinition[] = [];

  scanProseDescendants(doc, (node, _pos, parent) => {
    if (!node.isText || shouldSkipTextNode(node, parent)) {
      return;
    }

    const text = node.text || '';
    if (text.length > MAX_ABBR_TEXT_SCAN_CHARS) {
      return;
    }
    appendBoundedAbbrDefinitions(definitions, extractAbbrDefinitionsFromText(text));
  }, maxNodes);

  return definitions;
}

export function findAbbrUsages(
  doc: BoundedProseScanNode,
  definitions: AbbrDefinition[],
  maxNodes = MAX_ABBR_DOC_SCAN_NODES,
): { start: number; end: number; fullText: string }[] {
  const usages: { start: number; end: number; fullText: string }[] = [];

  if (definitions.length === 0) return usages;

  const abbrMap = new Map(definitions.map(d => [d.abbr, d.fullText]));
  const pattern = createAbbrUsagePattern(definitions);
  if (!pattern) return usages;

  scanProseDescendants(doc, (node, pos, parent) => {
    if (usages.length >= MAX_ABBR_DECORATIONS) {
      return STOP_PROSE_SCAN;
    }

    if (!node.isText || shouldSkipTextNode(node, parent)) {
      return;
    }

    const text = node.text || '';
    if (text.length > MAX_ABBR_TEXT_SCAN_CHARS) {
      return;
    }
    if (extractAbbrDefinitionsFromText(text).length > 0) {
      return;
    }

    let match;

    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const abbr = match[1];
      const fullText = abbrMap.get(abbr);

      if (fullText) {
        usages.push({
          start: pos + match.index,
          end: pos + match.index + abbr.length,
          fullText
        });
        if (usages.length >= MAX_ABBR_DECORATIONS) {
          break;
        }
      }
    }

    return usages.length < MAX_ABBR_DECORATIONS ? undefined : STOP_PROSE_SCAN;
  }, maxNodes);

  return usages;
}

export function findAbbrUsagesInRange(
  doc: any,
  definitions: AbbrDefinition[],
  from: number,
  to: number,
  maxScanNodes = MAX_ABBR_DOC_SCAN_NODES,
): { start: number; end: number; fullText: string }[] {
  const usages: { start: number; end: number; fullText: string }[] = [];
  if (definitions.length === 0 || typeof doc.nodesBetween !== 'function') return usages;

  const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
  const start = Math.max(0, Math.min(from, docSize));
  const end = Math.max(start, Math.min(to, docSize));
  if (start >= end) return usages;

  const abbrMap = new Map(definitions.map(d => [d.abbr, d.fullText]));
  const pattern = createAbbrUsagePattern(definitions);
  if (!pattern) return usages;

  let scannedNodes = 0;
  doc.nodesBetween(start, end, (node: BoundedProseScanNode, pos: number, parent: BoundedProseScanNode) => {
    scannedNodes += 1;
    if (scannedNodes > maxScanNodes) return false;
    if (usages.length >= MAX_ABBR_DECORATIONS) return false;
    if (!node.isText || shouldSkipTextNode(node, parent)) return true;

    const text = node.text || '';
    if (text.length > MAX_ABBR_TEXT_SCAN_CHARS) return true;
    if (extractAbbrDefinitionsFromText(text).length > 0) return true;

    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const abbr = match[1];
      const fullText = abbrMap.get(abbr);

      if (fullText) {
        usages.push({
          start: pos + match.index,
          end: pos + match.index + abbr.length,
          fullText
        });
        if (usages.length >= MAX_ABBR_DECORATIONS) break;
      }
    }

    return usages.length < MAX_ABBR_DECORATIONS;
  });

  return usages;
}

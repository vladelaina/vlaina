import type { DecorationAttrs } from '../typoraTextSemantics';
import {
  getNextContentSiblingEntry,
  getPreviousContentSiblingEntry,
  isHrNode,
  isIgnorableVlookLayoutSibling,
} from './shared';

function isVlookColumnListTarget(node: any): boolean {
  return node?.type?.name === 'bullet_list' || node?.type?.name === 'ordered_list';
}

function isVlookColumnBlockTarget(node: any): boolean {
  return node?.type?.name === 'blockquote' || node?.type?.name === 'callout';
}

function isVlookColumnTarget(node: any): boolean {
  return isVlookColumnListTarget(node) || isVlookColumnBlockTarget(node);
}

function getVlookHrRunCountBefore(parent: any, index: number | undefined): number {
  let count = 0;
  let entry = getPreviousContentSiblingEntry(parent, index);
  while (entry && isHrNode(entry.node)) {
    count += 1;
    entry = getPreviousContentSiblingEntry(parent, entry.index);
  }
  return Math.min(count, 4);
}

interface VlookColumnTargetInfo {
  columns: number;
  ordinal: number;
  type: 'list' | 'block';
}

function getVlookListColumnInfo(
  node: any,
  parent: any,
  index: number | undefined
): VlookColumnTargetInfo | null {
  if (!isVlookColumnListTarget(node)) return null;
  const markerCount = getVlookHrRunCountBefore(parent, index);
  if (markerCount <= 0) return null;
  return {
    columns: markerCount + 1,
    ordinal: 1,
    type: 'list',
  };
}

function getVlookBlockColumnInfo(
  node: any,
  parent: any,
  index: number | undefined
): VlookColumnTargetInfo | null {
  if (!isVlookColumnBlockTarget(node)) return null;

  let ordinal = 1;
  let entry = getPreviousContentSiblingEntry(parent, index);
  while (entry) {
    if (isVlookColumnBlockTarget(entry.node)) {
      ordinal += 1;
      entry = getPreviousContentSiblingEntry(parent, entry.index);
      continue;
    }

    if (!isHrNode(entry.node)) return null;

    const markerCount = getVlookHrRunCountBefore(parent, entry.index + 1);
    if (markerCount <= 0) return null;

    const columns = markerCount + 1;
    if (ordinal > columns) return null;
    return {
      columns,
      ordinal,
      type: 'block',
    };
  }

  return null;
}

function getVlookColumnTargetInfo(
  node: any,
  parent: any,
  index: number | undefined
): VlookColumnTargetInfo | null {
  return getVlookListColumnInfo(node, parent, index) ??
    getVlookBlockColumnInfo(node, parent, index);
}

export function getVlookColumnTargetAttrs(
  node: any,
  parent: any,
  index: number | undefined
): DecorationAttrs | null {
  const info = getVlookColumnTargetInfo(node, parent, index);
  if (!info) return null;

  const classes = [
    'vlook-column-block',
    `vlook-column-${info.columns}`,
    `vlook-column-item-${info.ordinal}`,
    info.ordinal === 1 ? 'vlook-column-first' : null,
    info.type === 'list' ? 'vlook-column-list' : 'vlook-column-quote',
  ];
  return { class: classes.filter(Boolean).join(' ') };
}

export function getVlookColumnMarkerAttrs(
  node: any,
  parent: any,
  index: number | undefined
): DecorationAttrs | null {
  if (!isHrNode(node) || !parent || typeof index !== 'number') return null;

  let markerCount = 0;
  let entry: { node: any; index: number } | null = { node, index };
  while (entry && isHrNode(entry.node)) {
    markerCount += 1;
    if (markerCount > 4) return null;
    entry = getNextContentSiblingEntry(parent, entry.index);
  }

  if (!entry || !isVlookColumnTarget(entry.node)) return null;
  return { class: 'v-column vlook-column-marker' };
}

export function getVlookColumnGapAttrs(
  node: any,
  parent: any,
  index: number | undefined
): DecorationAttrs | null {
  if (!isIgnorableVlookLayoutSibling(node)) return null;

  const previous = getPreviousContentSiblingEntry(parent, index);
  const next = getNextContentSiblingEntry(parent, index);
  if (!previous || !next) return null;

  if (
    isHrNode(previous.node) &&
    isHrNode(next.node) &&
    getVlookColumnMarkerAttrs(previous.node, parent, previous.index)
  ) {
    return { class: 'vlook-column-gap' };
  }

  if (
    isHrNode(previous.node) &&
    getVlookColumnTargetInfo(next.node, parent, next.index)
  ) {
    return { class: 'vlook-column-gap' };
  }

  if (
    isVlookColumnBlockTarget(previous.node) &&
    isVlookColumnBlockTarget(next.node) &&
    getVlookColumnTargetInfo(previous.node, parent, previous.index) &&
    getVlookColumnTargetInfo(next.node, parent, next.index)
  ) {
    return { class: 'vlook-column-gap' };
  }

  return null;
}

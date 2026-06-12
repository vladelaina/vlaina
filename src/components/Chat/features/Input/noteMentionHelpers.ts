import type { FileTreeNode, StarredEntry } from '@/stores/notes/types';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';

export interface NoteMentionCandidate {
  path: string;
  title: string;
  kind: 'note' | 'folder';
  isCurrent: boolean;
  icon?: string;
  notePath?: string;
  vaultPath?: string;
  starredEntry?: StarredEntry;
}

export interface MentionTrigger {
  start: number;
  end: number;
  query: string;
}

export interface MentionPreviewPart {
  key: string;
  type: 'text' | 'mention';
  text: string;
  start: number;
  end: number;
  mention?: NoteMentionReference;
}

const MAX_MENTION_CANDIDATE_TREE_NODES = 20_000;
export const MAX_MENTION_TITLE_SCAN_ITEMS = 5_000;
export const MAX_MENTION_TITLE_SCAN_CHARS = 128 * 1024;
export const MAX_MENTION_TITLE_CHARS = 512;

function getMentionCandidateNodePriority(node: FileTreeNode): number {
  if (hasInternalNotePathSegment(node.path)) {
    return 3;
  }
  if (!node.isFolder && isSupportedMarkdownPath(node.path)) {
    return 0;
  }
  if (node.isFolder) {
    return 1;
  }
  return 2;
}

function prioritizeMentionCandidateNodes(nodes: readonly FileTreeNode[]): FileTreeNode[] {
  return nodes
    .map((node, index) => ({ node, index, priority: getMentionCandidateNodePriority(node) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ node }) => node);
}

export function collectMentionCandidates(nodes: FileTreeNode[], result: NoteMentionCandidate[]): void {
  const stack = prioritizeMentionCandidateNodes(nodes).reverse();
  let visitedNodes = 0;

  while (stack.length > 0 && visitedNodes < MAX_MENTION_CANDIDATE_TREE_NODES) {
    const node = stack.pop()!;
    visitedNodes += 1;

    if (node.isFolder) {
      if (hasInternalNotePathSegment(node.path)) {
        continue;
      }
      const folderName = node.name || node.path.split('/').filter(Boolean).pop() || node.path;
      result.push({
        path: node.path,
        title: `${folderName.replace(/\/+$/, '')}/`,
        kind: 'folder',
        isCurrent: false,
      });
      const prioritizedChildren = prioritizeMentionCandidateNodes(node.children);
      for (let index = prioritizedChildren.length - 1; index >= 0; index -= 1) {
        stack.push(prioritizedChildren[index]);
      }
    } else if (isSupportedMarkdownPath(node.path) && !hasInternalNotePathSegment(node.path)) {
      result.push({
        path: node.path,
        title: '',
        kind: 'note',
        isCurrent: false,
        notePath: node.path,
      });
    }
  }
}

export function getNoteMentionTrigger(value: string, caret: number): MentionTrigger | null {
  if (caret < 0) {
    return null;
  }
  const before = value.slice(0, caret);
  const atIndex = before.lastIndexOf('@');
  if (atIndex < 0) {
    return null;
  }

  const query = before.slice(atIndex + 1);
  if (query.includes('\n') || query.includes('\r') || /\s/.test(query)) {
    return null;
  }

  return {
    start: atIndex,
    end: caret,
    query,
  };
}

export function buildMentionPreviewParts(
  value: string,
  mentions: NoteMentionReference[]
): MentionPreviewPart[] {
  if (!value) {
    return [];
  }

  const labels = mentions
    .map((mention) => ({
      mention,
      label: `@${mention.title}`,
    }))
    .sort((a, b) => b.label.length - a.label.length);
  const labelsByInitial = new Map<string, typeof labels>();
  for (const label of labels) {
    const initial = label.label[1] ?? '';
    const group = labelsByInitial.get(initial);
    if (group) {
      group.push(label);
    } else {
      labelsByInitial.set(initial, [label]);
    }
  }

  if (labels.length === 0) {
    return [{ key: 'text-0', type: 'text', text: value, start: 0, end: value.length }];
  }

  const parts: MentionPreviewPart[] = [];
  let cursor = 0;
  let partIndex = 0;

  while (cursor < value.length) {
    let nextMatchIndex = -1;
    let nextMatch: (typeof labels)[number] | null = null;
    let atIndex = cursor;

    while (atIndex < value.length) {
      atIndex = value.indexOf('@', atIndex);
      if (atIndex < 0) {
        break;
      }
      if (!hasMentionStartBoundary(value, atIndex)) {
        atIndex += 1;
        continue;
      }

      const initial = value[atIndex + 1] ?? '';
      const candidateLabels = [
        ...(labelsByInitial.get(initial) ?? []),
        ...(initial ? labelsByInitial.get('') ?? [] : []),
      ];
      nextMatch = candidateLabels.find((label) =>
        value.startsWith(label.label, atIndex) &&
        hasMentionEndBoundary(value, atIndex + label.label.length)
      ) ?? null;
      if (nextMatch) {
        nextMatchIndex = atIndex;
        break;
      }
      atIndex += 1;
    }

    if (nextMatchIndex < 0 || !nextMatch) {
      const rest = value.slice(cursor);
      if (rest.length > 0) {
        parts.push({
          key: `text-${partIndex++}`,
          type: 'text',
          text: rest,
          start: cursor,
          end: value.length,
        });
      }
      break;
    }

    const before = value.slice(cursor, nextMatchIndex);
    if (before.length > 0) {
      parts.push({
        key: `text-${partIndex++}`,
        type: 'text',
        text: before,
        start: cursor,
        end: nextMatchIndex,
      });
    }

    parts.push({
      key: `mention-${partIndex++}-${nextMatch.mention.path}`,
      type: 'mention',
      text: nextMatch.label,
      start: nextMatchIndex,
      end: nextMatchIndex + nextMatch.label.length,
      mention: nextMatch.mention,
    });

    cursor = nextMatchIndex + nextMatch.label.length;
  }

  return parts;
}

function isMentionWordCharacter(value: string): boolean {
  return /^[\p{L}\p{N}_]$/u.test(value);
}

function hasMentionStartBoundary(value: string, index: number): boolean {
  if (index === 0) {
    return true;
  }
  return !isMentionWordCharacter(value[index - 1] ?? '');
}

function hasMentionEndBoundary(value: string, end: number): boolean {
  return end === value.length || !isMentionWordCharacter(value[end] ?? '');
}

function findMentionLabelIndex(value: string, label: string, fromIndex = 0): number {
  let index = value.indexOf(label, fromIndex);
  while (index >= 0) {
    const end = index + label.length;
    if (hasMentionStartBoundary(value, index) && hasMentionEndBoundary(value, end)) {
      return index;
    }
    index = value.indexOf(label, index + label.length);
  }
  return -1;
}

export function valueContainsMentionLabel(value: string, title: string): boolean {
  return findMentionLabelIndex(value, `@${title}`) >= 0;
}

interface MentionLabelTrieNode {
  children: Map<string, MentionLabelTrieNode>;
  titles?: string[];
}

function createMentionLabelTrie(titles: Iterable<string>): MentionLabelTrieNode {
  const root: MentionLabelTrieNode = { children: new Map() };
  const seenTitles = new Set<string>();
  let scannedTitles = 0;
  let scannedTitleChars = 0;

  for (const title of titles) {
    scannedTitles += 1;
    if (scannedTitles > MAX_MENTION_TITLE_SCAN_ITEMS) {
      break;
    }
    if (!title || seenTitles.has(title)) {
      continue;
    }
    if (title.length > MAX_MENTION_TITLE_CHARS) {
      continue;
    }
    scannedTitleChars += title.length;
    if (scannedTitleChars > MAX_MENTION_TITLE_SCAN_CHARS) {
      break;
    }
    seenTitles.add(title);

    const label = `@${title}`;
    let node = root;
    for (let index = 0; index < label.length; index += 1) {
      const character = label[index];
      let child = node.children.get(character);
      if (!child) {
        child = { children: new Map() };
        node.children.set(character, child);
      }
      node = child;
    }
    node.titles = [...(node.titles ?? []), title];
  }

  return root;
}

export function findMentionTitlesInValue(value: string, titles: Iterable<string>): Set<string> {
  const matches = new Set<string>();
  if (!value.includes('@')) {
    return matches;
  }

  const root = createMentionLabelTrie(titles);
  if (root.children.size === 0) {
    return matches;
  }

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '@' || !hasMentionStartBoundary(value, index)) {
      continue;
    }

    let node: MentionLabelTrieNode | undefined = root;
    for (let cursor = index; cursor < value.length; cursor += 1) {
      node = node.children.get(value[cursor]);
      if (!node) {
        break;
      }

      if (node.titles && hasMentionEndBoundary(value, cursor + 1)) {
        for (const title of node.titles) {
          matches.add(title);
        }
      }
    }
  }

  return matches;
}

export function insertMentionAtTrigger(
  value: string,
  trigger: MentionTrigger,
  mentionTitle: string
): { nextValue: string; nextCaret: number } {
  const prefix = value.slice(0, trigger.start);
  const suffix = value.slice(trigger.end);
  const label = `@${mentionTitle}`;
  const trailingSpace = suffix.startsWith(' ') || suffix.startsWith('\n') ? '' : ' ';
  const nextValue = `${prefix}${label}${trailingSpace}${suffix}`;
  const nextCaret = prefix.length + label.length + trailingSpace.length;
  return { nextValue, nextCaret };
}

import type { FileTreeNode, StarredEntry } from '@/stores/notes/types';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';

export interface NoteMentionCandidate {
  path: string;
  title: string;
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

export function collectNotePaths(nodes: FileTreeNode[], result: string[]): void {
  for (const node of nodes) {
    if (node.isFolder) {
      collectNotePaths(node.children, result);
    } else if (node.path.toLowerCase().endsWith('.md')) {
      result.push(node.path);
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

  if (labels.length === 0) {
    return [{ key: 'text-0', type: 'text', text: value, start: 0, end: value.length }];
  }

  const parts: MentionPreviewPart[] = [];
  let cursor = 0;
  let partIndex = 0;

  while (cursor < value.length) {
    let nextMatchIndex = -1;
    let nextMatch: (typeof labels)[number] | null = null;

    for (const label of labels) {
      const index = value.indexOf(label.label, cursor);
      if (index < 0) {
        continue;
      }
      if (nextMatchIndex < 0 || index < nextMatchIndex) {
        nextMatchIndex = index;
        nextMatch = label;
      }
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

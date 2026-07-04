import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import {
  dedupeNoteMentions,
  isPotentiallyLoadableNoteMentionReference,
  MAX_NOTE_MENTION_SCAN_ITEMS,
} from '@/lib/ai/noteMentions';
import { MAX_NOTE_MENTION_COUNT } from './noteMentionConfig';

export function normalizeNoteMentions(noteMentions: NoteMentionReference[]): NoteMentionReference[] {
  return dedupeNoteMentions(noteMentions)
    .filter((mention) => isPotentiallyLoadableNoteMentionReference(mention, mention.kind))
    .slice(0, MAX_NOTE_MENTION_COUNT);
}

function isPotentiallyLoadableMentionReference(
  mention: NoteMentionReference,
  explicitKind: 'note' | 'folder' | undefined,
): boolean {
  return isPotentiallyLoadableNoteMentionReference(mention, explicitKind);
}

export function normalizeNoteMentionsForLoading(noteMentions: unknown): NoteMentionReference[] {
  const mentionList = Array.isArray(noteMentions) ? noteMentions : [];
  const explicitKindsByPath = new Map<string, 'note' | 'folder'>();
  const scanLimit = Math.min(mentionList.length, MAX_NOTE_MENTION_SCAN_ITEMS);
  for (let index = 0; index < scanLimit; index += 1) {
    const mention = mentionList[index];
    if (
      !mention ||
      typeof mention.path !== 'string' ||
      (mention.kind !== 'note' && mention.kind !== 'folder')
    ) {
      continue;
    }
    const path = mention.path.trim();
    if (path) {
      explicitKindsByPath.set(path, mention.kind);
    }
  }

  return dedupeNoteMentions(mentionList)
    .map((mention) => {
      const explicitKind = explicitKindsByPath.get(mention.path);
      return explicitKind ? { ...mention, kind: explicitKind } : {
        path: mention.path,
        title: mention.title,
      };
    })
    .filter((mention) => isPotentiallyLoadableMentionReference(
      mention,
      explicitKindsByPath.get(mention.path),
    ))
    .slice(0, MAX_NOTE_MENTION_COUNT);
}

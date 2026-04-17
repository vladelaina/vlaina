import { EMOJI_CATEGORIES, EMOJI_MAP } from './constants';

const SKIN_TONE_KEY = 'vlaina-emoji-skin-tone';

const FALLBACK_RANDOM_EMOJIS = ['📝', '✨', '📌', '🎯', '📚', '🌟', '🏇'];
const headerEmojiPoolByTone = new Map<number, string[]>();

export function loadSkinTonePreference(): number {
  try {
    const saved = localStorage.getItem(SKIN_TONE_KEY);
    return saved ? parseInt(saved, 10) : 0;
  } catch {
    return 0;
  }
}

function getFallbackRandomEmoji(): string {
  return FALLBACK_RANDOM_EMOJIS[Math.floor(Math.random() * FALLBACK_RANDOM_EMOJIS.length)];
}

function pickRandomEmoji(pool: readonly string[]): string {
  if (pool.length === 0) {
    return getFallbackRandomEmoji();
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

function buildHeaderEmojiPool(skinTone: number): string[] {
  const pool: string[] = [];
  const seen = new Set<string>();

  for (const category of EMOJI_CATEGORIES) {
    for (const emoji of category.emojis) {
      const resolvedEmoji = emoji.skins && emoji.skins.length > skinTone && skinTone > 0
        ? emoji.skins[skinTone].native
        : emoji.native;

      if (seen.has(resolvedEmoji)) {
        continue;
      }

      seen.add(resolvedEmoji);
      pool.push(resolvedEmoji);
    }
  }

  return pool;
}

function getHeaderEmojiPool(skinTone: number): string[] {
  const normalizedTone = Number.isFinite(skinTone) ? Math.max(0, Math.trunc(skinTone)) : 0;
  const cachedPool = headerEmojiPoolByTone.get(normalizedTone);
  if (cachedPool) {
    return cachedPool;
  }

  const nextPool = buildHeaderEmojiPool(normalizedTone);
  headerEmojiPoolByTone.set(normalizedTone, nextPool);
  return nextPool;
}

export function getRandomHeaderEmoji(excludedIcons?: Iterable<string>, skinTone: number = loadSkinTonePreference()): string {
  const pool = getHeaderEmojiPool(skinTone);
  const excludedSet = excludedIcons ? new Set(excludedIcons) : null;
  const availablePool = excludedSet
    ? pool.filter((emoji) => !excludedSet.has(emoji))
    : pool;

  return pickRandomEmoji(availablePool.length > 0 ? availablePool : pool);
}

export async function getRandomEmojiForSkinTone(skinTone: number): Promise<string> {
  return getRandomHeaderEmoji(undefined, skinTone);
}

export async function getRandomEmojiFromPreference(): Promise<string> {
  return getRandomHeaderEmoji(undefined, loadSkinTonePreference());
}

export async function resolveEmojiForSkinTone(emoji: string, skinTone: number): Promise<string> {
  const item = EMOJI_MAP.get(emoji);
  if (!item || !item.skins || item.skins.length <= skinTone) {
    return emoji;
  }

  return skinTone === 0 ? item.native : (item.skins[skinTone]?.native || item.native);
}

const SKIN_TONE_KEY = 'vlaina-emoji-skin-tone';

const FALLBACK_RANDOM_EMOJIS = ['📝', '✨', '📌', '🎯', '📚', '🌟', '🏇'];
const headerEmojiPoolByTone = new Map<number, string[]>();

interface EmojiSkin {
  native: string;
}

interface EmojiItem {
  native: string;
  skins?: EmojiSkin[];
}

interface EmojiCategory {
  emojis: EmojiItem[];
}

interface EmojiConstantsSnapshot {
  categories: EmojiCategory[];
  emojiMap: Map<string, EmojiItem>;
}

let emojiConstantsSnapshot: EmojiConstantsSnapshot | null = null;
let emojiConstantsPromise: Promise<EmojiConstantsSnapshot> | null = null;

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

function normalizeSkinTone(skinTone: number): number {
  return Number.isFinite(skinTone) ? Math.max(0, Math.trunc(skinTone)) : 0;
}

async function loadEmojiConstants(): Promise<EmojiConstantsSnapshot> {
  if (emojiConstantsSnapshot) {
    return emojiConstantsSnapshot;
  }

  if (!emojiConstantsPromise) {
    emojiConstantsPromise = import('./constants').then((mod) => {
      emojiConstantsSnapshot = {
        categories: mod.EMOJI_CATEGORIES,
        emojiMap: mod.EMOJI_MAP,
      };
      return emojiConstantsSnapshot;
    });
  }

  return emojiConstantsPromise;
}

function getCachedEmojiConstants(): EmojiConstantsSnapshot | null {
  return emojiConstantsSnapshot;
}

function buildHeaderEmojiPool(categories: readonly EmojiCategory[], skinTone: number): string[] {
  const pool: string[] = [];
  const seen = new Set<string>();

  for (const category of categories) {
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

function getCachedHeaderEmojiPool(skinTone: number): string[] | null {
  const snapshot = getCachedEmojiConstants();
  if (!snapshot) {
    return null;
  }

  const normalizedTone = normalizeSkinTone(skinTone);
  const cachedPool = headerEmojiPoolByTone.get(normalizedTone);
  if (cachedPool) {
    return cachedPool;
  }

  const nextPool = buildHeaderEmojiPool(snapshot.categories, normalizedTone);
  headerEmojiPoolByTone.set(normalizedTone, nextPool);
  return nextPool;
}

export async function preloadRandomEmojiData(): Promise<void> {
  const snapshot = await loadEmojiConstants();
  const tone = loadSkinTonePreference();
  const normalizedTone = normalizeSkinTone(tone);
  if (!headerEmojiPoolByTone.has(normalizedTone)) {
    headerEmojiPoolByTone.set(normalizedTone, buildHeaderEmojiPool(snapshot.categories, normalizedTone));
  }
}

export function getRandomHeaderEmoji(excludedIcons?: Iterable<string>, skinTone: number = loadSkinTonePreference()): string {
  const pool = getCachedHeaderEmojiPool(skinTone) ?? FALLBACK_RANDOM_EMOJIS;
  const excludedSet = excludedIcons ? new Set(excludedIcons) : null;
  const availablePool = excludedSet
    ? pool.filter((emoji) => !excludedSet.has(emoji))
    : pool;

  return pickRandomEmoji(availablePool.length > 0 ? availablePool : pool);
}

export async function getRandomEmojiForSkinTone(skinTone: number): Promise<string> {
  await preloadRandomEmojiData();
  return getRandomHeaderEmoji(undefined, skinTone);
}

export async function getRandomEmojiFromPreference(): Promise<string> {
  await preloadRandomEmojiData();
  return getRandomHeaderEmoji(undefined, loadSkinTonePreference());
}

export async function resolveEmojiForSkinTone(emoji: string, skinTone: number): Promise<string> {
  const snapshot = await loadEmojiConstants();
  const item = snapshot.emojiMap.get(emoji);
  if (!item || !item.skins || item.skins.length <= skinTone) {
    return emoji;
  }

  return skinTone === 0 ? item.native : (item.skins[skinTone]?.native || item.native);
}

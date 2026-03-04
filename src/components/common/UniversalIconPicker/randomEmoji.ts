const SKIN_TONE_KEY = 'nekotick-emoji-skin-tone';

const FALLBACK_RANDOM_EMOJIS = ['📝', '✨', '📌', '🎯', '📚', '🌟', '🏇'];

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

export async function getRandomEmojiForSkinTone(skinTone: number): Promise<string> {
  try {
    const { getRandomEmoji } = await import('./constants');
    return getRandomEmoji(skinTone);
  } catch {
    return getFallbackRandomEmoji();
  }
}

export async function getRandomEmojiFromPreference(): Promise<string> {
  return getRandomEmojiForSkinTone(loadSkinTonePreference());
}

export async function resolveEmojiForSkinTone(emoji: string, skinTone: number): Promise<string> {
  try {
    const { EMOJI_MAP } = await import('./constants');
    const item = EMOJI_MAP.get(emoji);
    if (!item || !item.skins || item.skins.length <= skinTone) {
      return emoji;
    }
    return skinTone === 0 ? item.native : (item.skins[skinTone]?.native || item.native);
  } catch {
    return emoji;
  }
}

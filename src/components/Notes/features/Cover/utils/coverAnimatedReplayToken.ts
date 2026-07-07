const ANIMATED_REPLAY_TOKEN_REUSE_WINDOW_MS = 500;
const MAX_ANIMATED_REPLAY_TOKEN_CACHE_ENTRIES = 500;
let animatedReplayTokenCounter = 0;

interface AnimatedReplayTokenEntry {
  token: string;
  createdAt: number;
}

const animatedReplayTokenCache = new Map<string, AnimatedReplayTokenEntry>();

function getNowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function createAnimatedReplayToken(): string {
  animatedReplayTokenCounter += 1;
  return `${Date.now().toString(36)}-${animatedReplayTokenCounter.toString(36)}`;
}

function getAnimatedReplayToken(url: string): string {
  const now = getNowMs();
  const cached = animatedReplayTokenCache.get(url);
  if (cached && now - cached.createdAt <= ANIMATED_REPLAY_TOKEN_REUSE_WINDOW_MS) {
    animatedReplayTokenCache.delete(url);
    animatedReplayTokenCache.set(url, cached);
    return cached.token;
  }

  if (cached) {
    animatedReplayTokenCache.delete(url);
  }

  const entry = {
    token: createAnimatedReplayToken(),
    createdAt: now,
  };
  animatedReplayTokenCache.set(url, entry);

  while (animatedReplayTokenCache.size > MAX_ANIMATED_REPLAY_TOKEN_CACHE_ENTRIES) {
    const oldestKey = animatedReplayTokenCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    animatedReplayTokenCache.delete(oldestKey);
  }

  return entry.token;
}

function appendAnimatedReplayToken(url: string): string {
  const token = getAnimatedReplayToken(url);
  return `${url}${url.includes('#') ? '&' : '#'}vlaina-replay=${token}`;
}

export function clearAnimatedReplayTokenCache(): void {
  animatedReplayTokenCache.clear();
}

export function shouldPreserveAssetAnimation(assetPath: string) {
  const pathname = assetPath.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  return pathname.endsWith('.gif') || pathname.endsWith('.apng') || pathname.endsWith('.webp');
}

export function applyAnimatedReplayToken(url: string, assetPath: string, replayAnimated: boolean | undefined): string {
  return replayAnimated && shouldPreserveAssetAnimation(assetPath)
    ? appendAnimatedReplayToken(url)
    : url;
}

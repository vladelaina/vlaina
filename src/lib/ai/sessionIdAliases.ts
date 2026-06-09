import { isSafeChatSessionId } from '@/lib/storage/unifiedStorageAI';

const sessionIdAliases = new Map<string, string>();
export const MAX_SESSION_ID_ALIASES = 512;

export function aliasSessionId(fromSessionId: string, toSessionId: string) {
  if (!isSafeChatSessionId(fromSessionId) || !isSafeChatSessionId(toSessionId)) {
    return;
  }
  sessionIdAliases.delete(fromSessionId);
  sessionIdAliases.set(fromSessionId, toSessionId);
  while (sessionIdAliases.size > MAX_SESSION_ID_ALIASES) {
    const oldestAlias = sessionIdAliases.keys().next().value;
    if (typeof oldestAlias !== 'string') {
      break;
    }
    sessionIdAliases.delete(oldestAlias);
  }
}

export function resolveSessionIdAlias(sessionId: string): string {
  let current = sessionId;
  const seen = new Set<string>();

  while (sessionIdAliases.has(current) && !seen.has(current)) {
    seen.add(current);
    current = sessionIdAliases.get(current)!;
  }

  return current;
}

export function getSessionIdAliasesResolvingTo(sessionId: string): string[] {
  const resolvedSessionId = resolveSessionIdAlias(sessionId);
  const aliases: string[] = [];

  sessionIdAliases.forEach((_targetSessionId, aliasSessionId) => {
    if (aliasSessionId !== resolvedSessionId && resolveSessionIdAlias(aliasSessionId) === resolvedSessionId) {
      aliases.push(aliasSessionId);
    }
  });

  return aliases;
}

export function clearSessionIdAlias(sessionId: string) {
  sessionIdAliases.delete(sessionId);
}

export function clearSessionIdAliases() {
  sessionIdAliases.clear();
}

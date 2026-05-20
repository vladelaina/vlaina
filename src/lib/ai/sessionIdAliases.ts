const sessionIdAliases = new Map<string, string>();

export function aliasSessionId(fromSessionId: string, toSessionId: string) {
  sessionIdAliases.set(fromSessionId, toSessionId);
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

export function clearSessionIdAlias(sessionId: string) {
  sessionIdAliases.delete(sessionId);
}

export function clearSessionIdAliases() {
  sessionIdAliases.clear();
}

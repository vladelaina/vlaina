const HOST_RE = /^[a-z0-9.-]+$/i;

function stripInlineComment(line) {
  const index = line.indexOf(' #');
  return index >= 0 ? line.slice(0, index).trim() : line;
}

function normalizeHost(hostname) {
  const host = String(hostname ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\*\./, '')
    .replace(/^www\./, '')
    .replace(/\.+$/, '');
  if (!host || host.includes('*') || host.includes('/') || host.includes(':')) return '';
  if (!HOST_RE.test(host)) return '';
  if (!host.includes('.')) return '';
  return host;
}

function extractHostFromAdblockRule(rule) {
  const match = rule.match(/^\|\|([^/^$*]+)\^?/);
  return match ? normalizeHost(match[1]) : '';
}

function extractHostFromUrlLikeRule(rule) {
  const withoutSchemeWildcard = rule
    .replace(/^\*:\/\/\*\./, 'https://')
    .replace(/^\*:\/\/\./, 'https://')
    .replace(/^\*:\/\/\*/, 'https://')
    .replace(/^\*:\/\/+/, 'https://');

  try {
    const parsed = new URL(
      withoutSchemeWildcard.includes('://') ? withoutSchemeWildcard : `https://${withoutSchemeWildcard}`,
    );
    return normalizeHost(parsed.hostname);
  } catch {
    const match = withoutSchemeWildcard.match(/^(?:https?:\/\/)?(?:\*\.)?([^/*^$]+)(?:[/*^$]|$)/i);
    return match ? normalizeHost(match[1]) : '';
  }
}

function shouldSkipRule(rule) {
  return (
    !rule ||
    rule.startsWith('!') ||
    rule.startsWith('#') ||
    rule.startsWith('[') ||
    rule.startsWith('@@') ||
    rule.startsWith('/') ||
    rule.includes('$script') ||
    rule.includes('$image') ||
    rule.includes('$stylesheet')
  );
}

export function extractHostFromUBlacklistRule(rawLine) {
  const rule = stripInlineComment(String(rawLine ?? '').trim());
  if (shouldSkipRule(rule)) return '';
  if (rule.startsWith('||')) return extractHostFromAdblockRule(rule);
  return extractHostFromUrlLikeRule(rule);
}

export function parseUBlacklistRules(text) {
  const hosts = [];
  const skippedRules = [];
  const seen = new Set();
  const lines = String(text ?? '').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = stripInlineComment(rawLine.trim());
    if (!line || shouldSkipRule(line)) continue;
    const host = extractHostFromUBlacklistRule(line);
    if (!host) {
      skippedRules.push(line);
      continue;
    }
    if (!seen.has(host)) {
      seen.add(host);
      hosts.push(host);
    }
  }

  return {
    hosts,
    skippedRules,
  };
}

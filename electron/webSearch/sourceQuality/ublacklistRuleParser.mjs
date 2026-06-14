const HOST_RE = /^[a-z0-9.-]+$/i;
const MAX_UBLACKLIST_RULE_TEXT_CHARS = 1_000_000;
const MAX_UBLACKLIST_RULE_LINE_CHARS = 4096;
const MAX_UBLACKLIST_HOST_CHARS = 253;

function stripInlineComment(line) {
  const index = line.indexOf(' #');
  return index >= 0 ? line.slice(0, index).trim() : line;
}

function normalizeHost(hostname) {
  if (typeof hostname !== 'string' || hostname.length > MAX_UBLACKLIST_HOST_CHARS) {
    return '';
  }
  const host = hostname
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
  if (typeof rawLine !== 'string' || rawLine.length > MAX_UBLACKLIST_RULE_LINE_CHARS) {
    return '';
  }
  const rule = stripInlineComment(rawLine.trim());
  if (shouldSkipRule(rule)) return '';
  if (rule.startsWith('||')) return extractHostFromAdblockRule(rule);
  return extractHostFromUrlLikeRule(rule);
}

export function parseUBlacklistRules(text) {
  const hosts = [];
  const skippedRules = [];
  const seen = new Set();
  const lines = typeof text === 'string' && text.length <= MAX_UBLACKLIST_RULE_TEXT_CHARS
    ? text.split(/\r?\n/)
    : [];

  for (const rawLine of lines) {
    if (rawLine.length > MAX_UBLACKLIST_RULE_LINE_CHARS) continue;
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

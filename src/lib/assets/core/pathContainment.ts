function normalizePathParts(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const uncRoot = getUncRoot(normalized);
  const driveMatch = normalized.match(/^([A-Za-z]:)(?:\/|$)/);
  const prefix = uncRoot ?? (driveMatch ? `${driveMatch[1]}/` : normalized.startsWith('/') ? '/' : '');
  const rest = prefix ? normalized.slice(prefix.length).replace(/^\/+/, '') : normalized;
  const parts: string[] = [];

  for (const part of rest.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length > 0 && parts[parts.length - 1] !== '..') {
        parts.pop();
      } else if (!prefix) {
        parts.push(part);
      }
      continue;
    }
    parts.push(part);
  }

  if (!prefix) {
    return parts.join('/') || '.';
  }

  return parts.length > 0
    ? `${prefix}${prefix.endsWith('/') ? '' : '/'}${parts.join('/')}`
    : prefix;
}

function getUncRoot(normalizedPath: string): string | null {
  if (!normalizedPath.startsWith('//') || normalizedPath.startsWith('///')) {
    return null;
  }

  const serverEnd = normalizedPath.indexOf('/', 2);
  if (serverEnd === -1) {
    return null;
  }

  const shareStart = serverEnd + 1;
  const shareEnd = normalizedPath.indexOf('/', shareStart);
  const share = shareEnd === -1
    ? normalizedPath.slice(shareStart)
    : normalizedPath.slice(shareStart, shareEnd);

  if (!share) {
    return null;
  }

  return shareEnd === -1 ? normalizedPath : normalizedPath.slice(0, shareEnd);
}

function normalizeForCompare(path: string): string {
  const normalized = normalizePathParts(path).replace(/\/+$/, '');
  return /^[A-Za-z]:/.test(normalized) || normalized.startsWith('//')
    ? normalized.toLowerCase()
    : normalized;
}

export function normalizeContainedAssetPath(path: string, rootPath: string): string | null {
  const root = normalizeForCompare(rootPath);
  const candidate = normalizeForCompare(path);
  if (candidate !== root && !candidate.startsWith(`${root}/`)) {
    return null;
  }

  const normalized = normalizePathParts(path);
  return rootPath.includes('\\') ? normalized.replace(/\//g, '\\') : normalized;
}

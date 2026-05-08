function normalizePathParts(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const driveMatch = normalized.match(/^([A-Za-z]:)(?:\/|$)/);
  const prefix = driveMatch ? `${driveMatch[1]}/` : normalized.startsWith('/') ? '/' : '';
  const rest = prefix ? normalized.slice(prefix.length) : normalized;
  const parts: string[] = [];

  for (const part of rest.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length > 0) {
        parts.pop();
      }
      continue;
    }
    parts.push(part);
  }

  return `${prefix}${parts.join('/')}` || '.';
}

function normalizeForCompare(path: string): string {
  const normalized = normalizePathParts(path).replace(/\/+$/, '');
  return /^[A-Za-z]:/.test(normalized) ? normalized.toLowerCase() : normalized;
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

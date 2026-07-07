function parseNumericPrefix(value) {
  const match = String(value ?? '').match(/^\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

function parsePrereleaseIdentifier(identifier) {
  const value = String(identifier ?? '');
  return /^\d+$/.test(value)
    ? { numeric: true, value: Number.parseInt(value, 10), raw: value }
    : { numeric: false, value: 0, raw: value.toLowerCase() };
}

function parseReleaseVersion(version) {
  const normalized = normalizeReleaseVersion(version);
  const withoutBuild = normalized.split('+', 1)[0] ?? '';
  const prereleaseSeparatorIndex = withoutBuild.indexOf('-');
  const core = prereleaseSeparatorIndex >= 0
    ? withoutBuild.slice(0, prereleaseSeparatorIndex)
    : withoutBuild;
  const prerelease = prereleaseSeparatorIndex >= 0
    ? withoutBuild.slice(prereleaseSeparatorIndex + 1)
    : '';

  return {
    coreParts: core.split('.').map(parseNumericPrefix),
    prereleaseParts: prerelease
      ? prerelease.split('.').filter(Boolean).map(parsePrereleaseIdentifier)
      : [],
  };
}

function comparePrereleaseParts(leftParts, rightParts) {
  if (leftParts.length === 0 && rightParts.length === 0) return 0;
  if (leftParts.length === 0) return 1;
  if (rightParts.length === 0) return -1;

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const left = leftParts[index];
    const right = rightParts[index];
    if (!left) return -1;
    if (!right) return 1;
    if (left.numeric && right.numeric) {
      if (left.value > right.value) return 1;
      if (left.value < right.value) return -1;
      continue;
    }
    if (left.numeric !== right.numeric) {
      return left.numeric ? -1 : 1;
    }
    if (left.raw > right.raw) return 1;
    if (left.raw < right.raw) return -1;
  }

  return 0;
}

export function compareVersions(left, right) {
  const leftVersion = parseReleaseVersion(left);
  const rightVersion = parseReleaseVersion(right);
  const length = Math.max(leftVersion.coreParts.length, rightVersion.coreParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftVersion.coreParts[index] ?? 0;
    const rightPart = rightVersion.coreParts[index] ?? 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return comparePrereleaseParts(leftVersion.prereleaseParts, rightVersion.prereleaseParts);
}

export function normalizeReleaseVersion(rawVersion) {
  return String(rawVersion ?? '')
    .trim()
    .replace(/^v/i, '');
}

import { normalizeHttpUrl } from './externalUrlPolicy.mjs';

const knownArchAliases = ['x64', 'x86_64', 'amd64', 'arm64', 'aarch64', 'ia32', 'x86'];

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

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

function splitReleaseAssetNameParts(name) {
  return String(name ?? '')
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter(Boolean);
}

export function getCurrentAssetArchAliases(arch = process.arch) {
  if (arch === 'x64') return ['x64', 'x86_64', 'amd64'];
  if (arch === 'arm64') return ['arm64', 'aarch64'];
  if (arch === 'ia32') return ['ia32', 'x86'];
  return [arch];
}

function releaseAssetPartsIncludeAny(parts, aliases) {
  return aliases.some((alias) => parts.includes(alias));
}

function normalizeAssetSha256(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase().replace(/^sha256:/, '');
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : '';
}

function isRetryableUpdateManifestStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeReleaseAssets(rawAssets) {
  if (!Array.isArray(rawAssets)) {
    return [];
  }

  return rawAssets
    .map((asset) => {
      if (!asset || typeof asset !== 'object') {
        return null;
      }

      const name = typeof asset.name === 'string' ? asset.name : '';
      const downloadUrl = typeof asset.browser_download_url === 'string'
        ? asset.browser_download_url
        : typeof asset.downloadUrl === 'string'
          ? asset.downloadUrl
          : '';

      if (!name || !downloadUrl) {
        return null;
      }

      try {
        return {
          name,
          downloadUrl: normalizeHttpUrl(downloadUrl, 'Release asset URL'),
          sha256: normalizeAssetSha256(
            asset.sha256 ?? asset.checksum ?? asset.digest
          ),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function getCurrentPlatformAssetPriority(platform = process.platform) {
  if (platform === 'win32') {
    return [
      (name) => name.endsWith('.exe') && name.includes('setup') && !name.includes('portable'),
      (name) => name.endsWith('.exe') && !name.includes('portable'),
      (name) => name.endsWith('.exe'),
    ];
  }

  if (platform === 'darwin') {
    return [
      (name) => name.endsWith('.dmg'),
      (name) => name.endsWith('.zip'),
    ];
  }

  if (platform === 'linux') {
    return [
      (name) => name.endsWith('.appimage'),
      (name) => name.endsWith('.deb'),
      (name) => name.endsWith('.tar.gz'),
    ];
  }

  return [];
}

export function selectCurrentPlatformAsset(assets, {
  platform = process.platform,
  arch = process.arch,
} = {}) {
  const platformPriority = getCurrentPlatformAssetPriority(platform);
  const normalizedAssets = assets.map((asset) => ({
    ...asset,
    normalizedName: asset.name.toLowerCase(),
    nameParts: splitReleaseAssetNameParts(asset.name),
  }));
  const platformAssets = normalizedAssets.filter((asset) =>
    platformPriority.some((matchesAsset) => matchesAsset(asset.normalizedName))
  );
  const currentArchAliases = getCurrentAssetArchAliases(arch);
  const currentArchAssets = platformAssets.filter((asset) =>
    releaseAssetPartsIncludeAny(asset.nameParts, currentArchAliases)
  );
  const platformAssetsWithKnownArch = platformAssets.filter((asset) =>
    releaseAssetPartsIncludeAny(asset.nameParts, knownArchAliases)
  );
  const candidateAssets = currentArchAssets.length > 0
    ? currentArchAssets
    : platformAssetsWithKnownArch.length > 0
      ? []
      : platformAssets;

  for (const matchesAsset of platformPriority) {
    const match = candidateAssets.find((asset) => matchesAsset(asset.normalizedName));
    if (match) {
      return {
        name: match.name,
        downloadUrl: match.downloadUrl,
        sha256: match.sha256 ?? '',
      };
    }
  }

  return null;
}

export function normalizeUpdateManifest(payload, {
  defaultDownloadUrl,
  platform = process.platform,
  arch = process.arch,
} = {}) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Update manifest must be a JSON object.');
  }

  const latestVersion = requireNonEmptyString(
    payload.version ?? payload.tag_name,
    'latest version'
  ).trim();
  const normalizedLatestVersion = normalizeReleaseVersion(latestVersion);
  const releaseUrl = normalizeHttpUrl(
    payload.downloadUrl ?? payload.html_url ?? defaultDownloadUrl,
    'Download URL'
  );
  const assets = normalizeReleaseAssets(payload.assets);
  const platformAsset = selectCurrentPlatformAsset(assets, { platform, arch });
  const releaseNotes = typeof payload.releaseNotes === 'string'
    ? payload.releaseNotes
    : typeof payload.body === 'string'
      ? payload.body
      : '';
  const publishedAt = typeof payload.publishedAt === 'string'
    ? payload.publishedAt
    : typeof payload.published_at === 'string'
      ? payload.published_at
      : '';

  return {
    latestVersion: normalizedLatestVersion,
    downloadUrl: platformAsset?.downloadUrl ?? releaseUrl,
    releaseUrl,
    platformAssetName: platformAsset?.name ?? '',
    platformAssetSha256: platformAsset?.sha256 ?? '',
    hasPlatformAsset: Boolean(platformAsset),
    releaseNotes,
    publishedAt,
  };
}

export async function fetchUpdateManifest({
  manifestUrl,
  defaultDownloadUrl,
  appVersion,
  fetchImpl = fetch,
  readJsonResponse,
  timeoutMs = 8000,
  allowLocalManifestUrl = false,
  retryDelaysMs = [],
}) {
  if (typeof readJsonResponse !== 'function') {
    throw new Error('Update manifest JSON reader must be provided.');
  }

  const normalizedManifestUrl = normalizeHttpUrl(manifestUrl, 'Update manifest URL', {
    allowLocalNetwork: allowLocalManifestUrl,
  });

  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(normalizedManifestUrl, {
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'user-agent': `vlaina/${appVersion} desktop-updater`,
        },
      });

      if (!response.ok) {
        throw new Error(`Update manifest request failed: HTTP ${response.status}`, {
          cause: { retryable: isRetryableUpdateManifestStatus(response.status) },
        });
      }

      return normalizeUpdateManifest(await readJsonResponse(response, {
        signal: controller.signal,
        tooLargeMessage: 'Update manifest response body is too large.',
      }), { defaultDownloadUrl });
    } catch (error) {
      const retryDelayMs = retryDelaysMs[attempt];
      const retryable = error?.cause?.retryable === true || error?.name === 'AbortError' || error instanceof TypeError;
      if (retryDelayMs == null || !retryable) {
        throw error;
      }
      await delay(retryDelayMs);
    } finally {
      clearTimeout(timeout);
    }
  }
}

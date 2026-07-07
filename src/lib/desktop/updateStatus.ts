import { APP_VERSION } from '@/lib/appVersion';
import type { ElectronUpdatePolicy } from '@/lib/electron/bridge';

export { createSimulatedDesktopUpdateInfo } from './simulatedUpdateStatus';

export const UPDATE_LAST_AUTO_CHECK_KEY = 'vlaina:update:lastAutoCheckAt';
export const UPDATE_INFO_CACHE_KEY = 'vlaina:update:lastResult';
export const UPDATE_INFO_CHANGED_EVENT = 'vlaina:update:info-changed';

const maxStringLength = 4000;

export interface DesktopUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl: string;
  releaseUrl: string;
  platformAssetName: string;
  platformAssetSha256?: string;
  hasPlatformAsset: boolean;
  releaseNotes: string;
  publishedAt: string;
  simulated?: boolean;
  downloadState?: 'downloading' | 'downloaded' | 'error';
  downloadedFilePath?: string;
  downloadedFileName?: string;
  downloadedAt?: string;
  downloadError?: string;
  updatePolicy?: ElectronUpdatePolicy;
}

export interface DesktopUpdateDownloadResult {
  filePath: string;
  fileName: string;
  downloadedAt: string;
  sizeBytes: number;
}

function parseNumericPrefix(value: unknown) {
  const match = String(value ?? '').match(/^\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

function parsePrereleaseIdentifier(identifier: unknown) {
  const value = String(identifier ?? '');
  return /^\d+$/.test(value)
    ? { numeric: true, value: Number.parseInt(value, 10), raw: value }
    : { numeric: false, value: 0, raw: value.toLowerCase() };
}

function normalizeReleaseVersion(rawVersion: unknown) {
  return String(rawVersion ?? '')
    .trim()
    .replace(/^v/i, '');
}

function parseReleaseVersion(version: unknown) {
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

function comparePrereleaseParts(
  leftParts: ReturnType<typeof parsePrereleaseIdentifier>[],
  rightParts: ReturnType<typeof parsePrereleaseIdentifier>[]
) {
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

export function compareDesktopUpdateVersions(left: unknown, right: unknown) {
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

export function isDesktopUpdateNewerThanCurrent(
  updateInfo: DesktopUpdateInfo,
  currentVersion = APP_VERSION
) {
  return updateInfo.updateAvailable && compareDesktopUpdateVersions(updateInfo.latestVersion, currentVersion) > 0;
}

export function getDesktopUpdateIndicatorVersion(updateInfo: DesktopUpdateInfo | null, currentVersion = APP_VERSION) {
  if (!updateInfo || !isDesktopUpdateNewerThanCurrent(updateInfo, currentVersion)) {
    return '';
  }
  return updateInfo.latestVersion;
}

function normalizeString(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, maxStringLength);
}

function normalizeBoolean(value: unknown) {
  return value === true;
}

function normalizeDesktopUpdatePolicy(value: unknown): ElectronUpdatePolicy | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<ElectronUpdatePolicy>;
  const distribution = candidate.distribution === 'microsoft-store' ? 'microsoft-store' : 'direct';

  return {
    distribution,
    checkEnabled: candidate.checkEnabled !== false,
    backgroundDownloadEnabled: candidate.backgroundDownloadEnabled !== false,
    localInstallerEnabled: candidate.localInstallerEnabled !== false,
    externalDownloadEnabled: candidate.externalDownloadEnabled !== false,
    cleanupDownloadedUpdatesEnabled: candidate.cleanupDownloadedUpdatesEnabled !== false,
  };
}

export function canBackgroundDownloadDesktopUpdate(updateInfo: DesktopUpdateInfo) {
  return updateInfo.updatePolicy?.backgroundDownloadEnabled !== false;
}

export function canOpenDesktopUpdateLocalInstaller(updateInfo: DesktopUpdateInfo) {
  return updateInfo.updatePolicy?.localInstallerEnabled !== false;
}

export function canOpenDesktopUpdateExternalDownload(updateInfo: DesktopUpdateInfo) {
  return updateInfo.updatePolicy?.externalDownloadEnabled !== false;
}

export function normalizeDesktopUpdateInfo(value: unknown): DesktopUpdateInfo | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<DesktopUpdateInfo>;
  const latestVersion = normalizeString(candidate.latestVersion);
  if (!latestVersion) return null;

  return {
    currentVersion: normalizeString(candidate.currentVersion, APP_VERSION),
    latestVersion,
    updateAvailable: normalizeBoolean(candidate.updateAvailable),
    downloadUrl: normalizeString(candidate.downloadUrl),
    releaseUrl: normalizeString(candidate.releaseUrl),
    platformAssetName: normalizeString(candidate.platformAssetName),
    platformAssetSha256: normalizeString(candidate.platformAssetSha256),
    hasPlatformAsset: normalizeBoolean(candidate.hasPlatformAsset),
    releaseNotes: normalizeString(candidate.releaseNotes),
    publishedAt: normalizeString(candidate.publishedAt),
    simulated: candidate.simulated === true,
    downloadState: candidate.downloadState === 'downloading' || candidate.downloadState === 'downloaded' || candidate.downloadState === 'error'
      ? candidate.downloadState
      : undefined,
    downloadedFilePath: normalizeString(candidate.downloadedFilePath),
    downloadedFileName: normalizeString(candidate.downloadedFileName),
    downloadedAt: normalizeString(candidate.downloadedAt),
    downloadError: normalizeString(candidate.downloadError),
    updatePolicy: normalizeDesktopUpdatePolicy(candidate.updatePolicy),
  };
}

function dispatchUpdateInfoChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(UPDATE_INFO_CHANGED_EVENT));
}

export function readStoredUpdateCheckTimestamp() {
  try {
    const value = Number.parseInt(window.localStorage.getItem(UPDATE_LAST_AUTO_CHECK_KEY) ?? '', 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function writeStoredUpdateCheckTimestamp(value: number) {
  try {
    window.localStorage.setItem(UPDATE_LAST_AUTO_CHECK_KEY, String(value));
  } catch {
    // Update checks are best effort; storage failures should not affect startup.
  }
}

export function readCachedDesktopUpdateInfo(): DesktopUpdateInfo | null {
  try {
    const raw = window.localStorage.getItem(UPDATE_INFO_CACHE_KEY);
    if (!raw) return null;
    return normalizeDesktopUpdateInfo(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeCachedDesktopUpdateInfo(updateInfo: DesktopUpdateInfo) {
  try {
    window.localStorage.setItem(UPDATE_INFO_CACHE_KEY, JSON.stringify(updateInfo));
    dispatchUpdateInfoChanged();
  } catch {
    // Update checks are best effort; storage failures should not affect startup.
  }
}

export function clearCachedDesktopUpdateInfo() {
  try {
    window.localStorage.removeItem(UPDATE_INFO_CACHE_KEY);
    dispatchUpdateInfoChanged();
  } catch {
    // Update checks are best effort; storage failures should not affect startup.
  }
}

export function markDesktopUpdateDownloadStarted(updateInfo: DesktopUpdateInfo) {
  writeCachedDesktopUpdateInfo({
    ...updateInfo,
    downloadState: 'downloading',
    downloadError: '',
  });
}

export function markDesktopUpdateDownloaded(
  updateInfo: DesktopUpdateInfo,
  downloadResult: DesktopUpdateDownloadResult
) {
  writeCachedDesktopUpdateInfo({
    ...updateInfo,
    downloadState: 'downloaded',
    downloadedFilePath: downloadResult.filePath,
    downloadedFileName: downloadResult.fileName,
    downloadedAt: downloadResult.downloadedAt,
    downloadError: '',
  });
}

export function markDesktopUpdateDownloadFailed(updateInfo: DesktopUpdateInfo, error: unknown) {
  writeCachedDesktopUpdateInfo({
    ...updateInfo,
    downloadState: 'error',
    downloadError: error instanceof Error ? error.message : 'Update download failed.',
  });
}

import { readSettingsApiJson } from './settingsApiJson';

export interface CommunitySettings {
  qqGroupNumber: string;
  qqQrCodeText: string;
  wechatQrCodeText: string;
}

export const emptyCommunitySettings: CommunitySettings = {
  qqGroupNumber: '',
  qqQrCodeText: '',
  wechatQrCodeText: '',
};

const siteSettingsUrl = 'https://api.vlaina.com/site-settings';

let cachedCommunitySettings: CommunitySettings | null = null;
let communitySettingsPromise: Promise<CommunitySettings> | null = null;

export function normalizeCommunitySettings(value: unknown): CommunitySettings {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    qqGroupNumber: typeof source.qqGroupNumber === 'string' ? source.qqGroupNumber.trim() : '',
    qqQrCodeText: typeof source.qqQrCodeText === 'string' ? source.qqQrCodeText.trim() : '',
    wechatQrCodeText: typeof source.wechatQrCodeText === 'string' ? source.wechatQrCodeText.trim() : '',
  };
}

export function getCachedCommunitySettings(): CommunitySettings {
  return cachedCommunitySettings ?? emptyCommunitySettings;
}

export function loadCommunitySettings(): Promise<CommunitySettings> {
  if (cachedCommunitySettings) {
    return Promise.resolve(cachedCommunitySettings);
  }

  if (communitySettingsPromise) {
    return communitySettingsPromise;
  }

  communitySettingsPromise = fetch(siteSettingsUrl, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return emptyCommunitySettings;
      const payload = await readSettingsApiJson<unknown>(response);
      if (!payload || typeof payload !== 'object') return emptyCommunitySettings;
      const settings = (payload as { settings?: { community?: unknown } }).settings;
      return normalizeCommunitySettings(settings?.community);
    })
    .catch(() => emptyCommunitySettings)
    .then((settings) => {
      cachedCommunitySettings = settings;
      return settings;
    });

  return communitySettingsPromise;
}

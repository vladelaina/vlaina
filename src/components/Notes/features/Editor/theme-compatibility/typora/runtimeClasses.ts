export const TYPORA_DOCUMENT_CLASSES = [
  'typora-export',
  'typora-export-content',
  'typora-node',
] as const;

export const TYPORA_OS_CLASSES = [
  'html-for-mac',
  'os-linux',
  'os-mac',
  'os-windows',
] as const;

export function resolveTyporaRuntimePlatformClasses(
  platform = globalThis.navigator?.platform ?? '',
  userAgent = globalThis.navigator?.userAgent ?? ''
): string[] {
  const fingerprint = `${platform} ${userAgent}`.toLowerCase();

  if (/\bmac|darwin|iphone|ipad|ipod/.test(fingerprint)) {
    return ['html-for-mac', 'os-mac'];
  }
  if (/\bwin/.test(fingerprint)) {
    return ['os-windows'];
  }
  if (/\blinux|x11|wayland/.test(fingerprint)) {
    return ['os-linux'];
  }

  return [];
}

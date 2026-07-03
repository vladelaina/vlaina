export type DesktopPlatformPreview = 'system' | 'macos';

function isNativeMacOS() {
  return (
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  );
}

export function isNativeWindows() {
  return (
    typeof navigator !== 'undefined' &&
    /Win/.test(navigator.platform)
  );
}

function isMacOSPreviewEnabled(platformPreview: DesktopPlatformPreview) {
  return import.meta.env.DEV && platformPreview === 'macos';
}

export function isMacOS(platformPreview: DesktopPlatformPreview = 'system') {
  return isMacOSPreviewEnabled(platformPreview) || isNativeMacOS();
}

export function shouldRenderMacOSTrafficLightPreview(
  platformPreview: DesktopPlatformPreview = 'system',
) {
  return isMacOSPreviewEnabled(platformPreview) && !isNativeMacOS();
}

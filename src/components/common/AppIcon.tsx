import { useCallback } from 'react';
import { UniversalIcon, type UniversalIconProps } from '@/components/common/UniversalIconPicker/UniversalIcon';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { getPaths } from '@/lib/storage/paths';
import { joinPath } from '@/lib/storage/adapter';

export async function loadAppIconImageSrc(src: string): Promise<string | null> {
  if (!/^img:/i.test(src)) return src;

  const path = src.substring(4).split(/[?#]/, 1)[0] ?? '';
  if (!path) return null;
  const { metadata } = await getPaths();
  const iconsRoot = await joinPath(metadata, 'assets', 'icons');
  const safePath = normalizeContainedAssetPath(path, iconsRoot);
  return safePath ? loadImageAsBlob(safePath) : null;
}

export function AppIcon(props: UniversalIconProps) {
  const defaultImageLoader = useCallback(async (src: string) => {
    return (await loadAppIconImageSrc(src)) ?? '';
  }, []);
  const { imageLoader, allowLegacyImageScheme, ...iconProps } = props;

  return (
    <UniversalIcon 
      {...iconProps}
      imageLoader={imageLoader || defaultImageLoader}
      allowLegacyImageScheme={allowLegacyImageScheme ?? true}
    />
  );
}

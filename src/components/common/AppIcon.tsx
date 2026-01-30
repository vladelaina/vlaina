import { useCallback } from 'react';
import { UniversalIcon, type UniversalIconProps } from '@/components/common/UniversalIconPicker/UniversalIcon';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';

/**
 * AppIcon - Application-aware wrapper for UniversalIcon
 * Automatically provides image loading logic for "img:" protocol assets.
 * Use this instead of UniversalIcon directly in application features.
 */
export function AppIcon(props: UniversalIconProps) {
  const defaultImageLoader = useCallback(async (src: string) => {
    // If it's a "img:" protocol, strip prefix and load as blob
    if (src.startsWith('img:')) {
        const path = src.substring(4);
        return await loadImageAsBlob(path);
    }
    return src;
  }, []);

  return (
    <UniversalIcon 
      imageLoader={props.imageLoader || defaultImageLoader}
      {...props} 
    />
  );
}
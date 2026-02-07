import { useCallback } from 'react';
import { UniversalIcon, type UniversalIconProps } from '@/components/common/UniversalIconPicker/UniversalIcon';
import { loadImageAsBlob } from '@/lib/assets/io/reader';

export function AppIcon(props: UniversalIconProps) {
  const defaultImageLoader = useCallback(async (src: string) => {
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

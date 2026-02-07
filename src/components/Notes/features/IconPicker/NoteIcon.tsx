import { UniversalIcon, type UniversalIconProps } from '@/components/common/UniversalIconPicker/UniversalIcon';
import { useNotesStore } from '@/stores/useNotesStore';
import { buildFullAssetPath } from '@/lib/assets/core/paths';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { useCallback } from 'react';
import { useUIStore } from '@/stores/uiSlice';

type NoteIconProps = Omit<UniversalIconProps, 'imageLoader'>;

export function NoteIcon(props: NoteIconProps) {
  const vaultPath = useNotesStore(s => s.notesPath);
  const { universalPreviewColor, universalPreviewTone } = useUIStore();

  const imageLoader = useCallback(async (src: string) => {
    if (!vaultPath) return src;
    const relativePath = src.substring(4);
    const fullPath = buildFullAssetPath(vaultPath, relativePath);
    return await loadImageAsBlob(fullPath);
  }, [vaultPath]);

  return (
    <UniversalIcon 
      {...props} 
      imageLoader={imageLoader}
      previewColor={props.previewColor ?? universalPreviewColor}
      previewTone={props.previewTone ?? universalPreviewTone}
    />
  );
}
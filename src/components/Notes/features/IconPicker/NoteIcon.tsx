import { UniversalIcon, type UniversalIconProps } from '@/components/common/UniversalIconPicker/UniversalIcon';
import { useNotesStore } from '@/stores/useNotesStore';
import { resolveVaultAssetPath } from '@/lib/assets/core/paths';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { useCallback } from 'react';
import { useUIStore } from '@/stores/uiSlice';

interface NoteIconProps extends Omit<UniversalIconProps, 'imageLoader'> {
  notePath?: string;
}

export function NoteIcon({ notePath, ...props }: NoteIconProps) {
  const vaultPath = useNotesStore(s => s.notesPath);
  const { universalPreviewColor, universalPreviewTone } = useUIStore();

  const imageLoader = useCallback(async (src: string) => {
    if (!vaultPath) return src;
    const relativePath = src.substring(4);
    const fullPath = await resolveVaultAssetPath(vaultPath, relativePath, notePath);
    return await loadImageAsBlob(fullPath);
  }, [notePath, vaultPath]);

  return (
    <UniversalIcon 
      {...props} 
      imageLoader={imageLoader}
      previewColor={props.previewColor ?? universalPreviewColor}
      previewTone={props.previewTone ?? universalPreviewTone}
    />
  );
}

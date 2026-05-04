import { UniversalIcon, type UniversalIconProps } from '@/components/common/UniversalIconPicker/UniversalIcon';
import { useNotesStore } from '@/stores/useNotesStore';
import { resolveVaultAssetPath } from '@/lib/assets/core/paths';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { useCallback } from 'react';
import { useUIStore } from '@/stores/uiSlice';

interface NoteIconProps extends Omit<UniversalIconProps, 'imageLoader'> {
  notePath?: string;
  vaultPath?: string;
}

export function NoteIcon({ notePath, vaultPath: vaultPathOverride, ...props }: NoteIconProps) {
  const notesPath = useNotesStore(s => s.notesPath);
  const universalPreviewColor = useUIStore((state) => state.universalPreviewColor);
  const universalPreviewTone = useUIStore((state) => state.universalPreviewTone);
  const vaultPath = vaultPathOverride || notesPath;

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

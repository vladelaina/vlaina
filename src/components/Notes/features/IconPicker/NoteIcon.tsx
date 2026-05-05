import { UniversalIcon, type UniversalIconProps } from '@/components/common/UniversalIconPicker/UniversalIcon';
import { useNotesStore } from '@/stores/useNotesStore';
import { resolveExistingVaultAssetPath } from '@/lib/assets/core/paths';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { useCallback } from 'react';
import { useUIStore } from '@/stores/uiSlice';
import { resolveEffectiveVaultPath } from '@/stores/notes/effectiveVaultPath';

interface NoteIconProps extends Omit<UniversalIconProps, 'imageLoader'> {
  notePath?: string;
  vaultPath?: string;
}

export function NoteIcon({ notePath, vaultPath: vaultPathOverride, ...props }: NoteIconProps) {
  const notesPath = useNotesStore(s => s.notesPath);
  const universalPreviewColor = useUIStore((state) => state.universalPreviewColor);
  const universalPreviewTone = useUIStore((state) => state.universalPreviewTone);
  const vaultPath = vaultPathOverride || resolveEffectiveVaultPath({ notesPath, currentNotePath: notePath });

  const imageLoader = useCallback(async (src: string) => {
    if (!vaultPath) return src;
    const relativePath = src.substring(4);
    const fullPath = await resolveExistingVaultAssetPath(vaultPath, relativePath, notePath);
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

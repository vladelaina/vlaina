import { UniversalIcon, type UniversalIconProps } from '@/components/common/UniversalIconPicker/UniversalIcon';
import { useNotesStore } from '@/stores/useNotesStore';
import { useCallback } from 'react';
import { useUIStore } from '@/stores/uiSlice';
import { resolveEffectiveVaultPath } from '@/stores/notes/effectiveVaultPath';
import { resolveCoverAssetUrl } from '@/components/Notes/features/Cover/utils/resolveCoverAssetUrl';

interface NoteIconProps extends Omit<UniversalIconProps, 'imageLoader' | 'allowLegacyImageScheme'> {
  notePath?: string;
  vaultPath?: string;
}

export function NoteIcon({ notePath, vaultPath: vaultPathOverride, ...props }: NoteIconProps) {
  const notesPath = useNotesStore(s => s.notesPath);
  const universalPreviewColor = useUIStore((state) => state.universalPreviewColor);
  const universalPreviewTone = useUIStore((state) => state.universalPreviewTone);
  const vaultPath = vaultPathOverride || resolveEffectiveVaultPath({ notesPath, currentNotePath: notePath });

  const imageLoader = useCallback(async (src: string) => {
    return resolveCoverAssetUrl({
      assetPath: src,
      vaultPath,
      currentNotePath: notePath,
      replayAnimated: true,
    });
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

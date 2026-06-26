import { UniversalIcon, type UniversalIconProps } from '@/components/common/UniversalIconPicker/UniversalIcon';
import { useNotesStore } from '@/stores/useNotesStore';
import { useMemo } from 'react';
import { useUIStore } from '@/stores/uiSlice';
import { resolveEffectiveVaultPath } from '@/stores/notes/effectiveVaultPath';
import { resolveCoverAssetUrl } from '@/components/Notes/features/Cover/utils/resolveCoverAssetUrl';

interface NoteIconProps extends Omit<UniversalIconProps, 'imageLoader' | 'allowLegacyImageScheme'> {
  notePath?: string;
  vaultPath?: string;
}

type NoteIconImageLoader = (src: string) => Promise<string>;

const NOTE_ICON_LOADER_CACHE_SEPARATOR = '\u001f';
const MAX_NOTE_ICON_IMAGE_LOADERS = 512;
const noteIconImageLoaders = new Map<string, NoteIconImageLoader>();

function getNoteIconImageLoader(vaultPath: string, notePath?: string): NoteIconImageLoader {
  const key = [vaultPath, notePath ?? ''].join(NOTE_ICON_LOADER_CACHE_SEPARATOR);
  const cached = noteIconImageLoaders.get(key);
  if (cached) {
    noteIconImageLoaders.delete(key);
    noteIconImageLoaders.set(key, cached);
    return cached;
  }

  const loader: NoteIconImageLoader = async (src) => {
    return resolveCoverAssetUrl({
      assetPath: src,
      vaultPath,
      currentNotePath: notePath,
      replayAnimated: true,
    });
  };

  noteIconImageLoaders.set(key, loader);
  while (noteIconImageLoaders.size > MAX_NOTE_ICON_IMAGE_LOADERS) {
    const oldestKey = noteIconImageLoaders.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    noteIconImageLoaders.delete(oldestKey);
  }

  return loader;
}

export function NoteIcon({ notePath, vaultPath: vaultPathOverride, ...props }: NoteIconProps) {
  const notesPath = useNotesStore(s => s.notesPath);
  const universalPreviewColor = useUIStore((state) => state.universalPreviewColor);
  const universalPreviewTone = useUIStore((state) => state.universalPreviewTone);
  const vaultPath = vaultPathOverride || resolveEffectiveVaultPath({ notesPath, currentNotePath: notePath });

  const imageLoader = useMemo(
    () => getNoteIconImageLoader(vaultPath, notePath),
    [notePath, vaultPath],
  );

  return (
    <UniversalIcon 
      {...props} 
      imageLoader={imageLoader}
      previewColor={props.previewColor ?? universalPreviewColor}
      previewTone={props.previewTone ?? universalPreviewTone}
    />
  );
}

/**
 * NoteIcon - Wrapper around UniversalIcon for Notes module
 * Handles Vault-specific image path resolution
 */

import { UniversalIcon, type UniversalIconProps } from '@/components/common/UniversalIconPicker/UniversalIcon';
import { useNotesStore } from '@/stores/useNotesStore';
import { buildFullAssetPath } from '@/lib/assets/pathUtils';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';
import { useCallback } from 'react';
import { useUIStore } from '@/stores/uiSlice';

// We omit imageLoader because we provide it internally
type NoteIconProps = Omit<UniversalIconProps, 'imageLoader'>;

export function NoteIcon(props: NoteIconProps) {
  const vaultPath = useNotesStore(s => s.notesPath);
  
  // Also grab preview color/tone if not provided directly, to maintain compatibility
  const { universalPreviewColor, universalPreviewTone } = useUIStore();

  const imageLoader = useCallback(async (src: string) => {
    if (!vaultPath) return src;
    // Remove "img:" prefix
    const relativePath = src.substring(4);
    const fullPath = buildFullAssetPath(vaultPath, relativePath);
    return await loadImageAsBlob(fullPath);
  }, [vaultPath]);

  return (
    <UniversalIcon 
      {...props} 
      imageLoader={imageLoader}
      // If props don't specify preview color/tone, fallback to global store
      previewColor={props.previewColor ?? universalPreviewColor}
      previewTone={props.previewTone ?? universalPreviewTone}
    />
  );
}
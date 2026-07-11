import { memo } from 'react';
import { useDisplayCoverAssetPath } from '@/hooks/useDisplayCover';
import { ImageFileNameBackground } from './ImageFileNameBackground';

export const NoteFileNameBackground = memo(function NoteFileNameBackground({
  notePath,
  notesPath,
}: {
  notePath: string;
  notesPath: string;
}) {
  const coverAssetPath = useDisplayCoverAssetPath(notePath);
  return coverAssetPath ? (
    <ImageFileNameBackground notesPath={notesPath} imagePath={coverAssetPath} />
  ) : null;
});

import { CoverImageShell } from './CoverImageShell';
import { useCoverImageController } from './hooks/useCoverImageController';
import type { CoverImageProps } from './coverImage.types';

export function CoverImage({
    url,
    positionX,
    positionY,
    height: initialHeight,
    scale = 1,
    readOnly = false,
    onUpdate,
    notesRootPath,
    currentNotePath,
    pickerOpen,
    onPickerOpenChange,
    onPreviewLayoutActiveChange,
}: CoverImageProps) {
  const shellProps = useCoverImageController({
    url,
    positionX,
    positionY,
    initialHeight,
    scale,
    readOnly,
    onUpdate,
    notesRootPath,
    currentNotePath,
    pickerOpen,
    onPickerOpenChange,
    onPreviewLayoutActiveChange,
  });

  return <CoverImageShell {...shellProps} />;
}

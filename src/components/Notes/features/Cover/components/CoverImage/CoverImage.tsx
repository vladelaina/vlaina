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
    vaultPath,
    pickerOpen,
    onPickerOpenChange,
}: CoverImageProps) {
  const shellProps = useCoverImageController({
    url,
    positionX,
    positionY,
    initialHeight,
    scale,
    readOnly,
    onUpdate,
    vaultPath,
    pickerOpen,
    onPickerOpenChange,
  });

  return <CoverImageShell {...shellProps} />;
}

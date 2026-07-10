import { CoverImage } from './CoverImage/CoverImage';
import type { NoteCoverController } from '../types';

interface NoteCoverCanvasProps {
  controller: NoteCoverController;
  notePath?: string;
  readOnly?: boolean;
  onPreviewLayoutActiveChange?: (active: boolean) => void;
}

export function NoteCoverCanvas({ controller, readOnly = false, onPreviewLayoutActiveChange }: NoteCoverCanvasProps) {
  const { cover, notesRootPath, isPickerOpen, setPickerOpen, updateCover } = controller;

  return (
    <CoverImage
      url={cover.url}
      positionX={cover.positionX}
      positionY={cover.positionY}
      height={cover.height}
      scale={cover.scale}
      onUpdate={updateCover}
      notesRootPath={notesRootPath}
      currentNotePath={controller.currentNotePath}
      readOnly={readOnly}
      pickerOpen={isPickerOpen}
      onPickerOpenChange={setPickerOpen}
      onPreviewLayoutActiveChange={onPreviewLayoutActiveChange}
    />
  );
}

import { CoverImage } from './CoverImage/CoverImage';
import type { NoteCoverController } from '../types';

interface NoteCoverCanvasProps {
  controller: NoteCoverController;
  notePath?: string;
}

export function NoteCoverCanvas({ controller }: NoteCoverCanvasProps) {
  const { cover, vaultPath, isPickerOpen, setPickerOpen, updateCover } = controller;

  return (
    <CoverImage
      url={cover.url}
      positionX={cover.positionX}
      positionY={cover.positionY}
      height={cover.height}
      scale={cover.scale}
      onUpdate={updateCover}
      vaultPath={vaultPath}
      currentNotePath={controller.currentNotePath}
      pickerOpen={isPickerOpen}
      onPickerOpenChange={setPickerOpen}
    />
  );
}

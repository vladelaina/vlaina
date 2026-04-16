import type { CoverRendererProps } from './coverRenderer.types';
import type { CoverFlowPhase } from './coverFlowPhase';

export interface CoverImageProps {
  url: string | null;
  positionX: number;
  positionY: number;
  height?: number;
  scale?: number;
  readOnly?: boolean;
  onUpdate: (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => void;
  vaultPath: string;
  currentNotePath?: string;
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
}

export interface CoverImageControllerModel {
  url: string | null;
  readOnly: boolean;
  vaultPath: string;
  currentNotePath?: string;
  phase: CoverFlowPhase;
  showPicker: boolean;
  previewSrc: string | null;
  isError: boolean;
  displaySrc: string;
  coverHeight: number;
  positionX: number;
  positionY: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onSelectCover: (assetPath: string) => void;
  onPreview: (assetPath: string | null) => void;
  onRemoveCover: () => void;
  onResizeMouseDown: (e: React.MouseEvent) => void;
  onResetHeight: () => void;
  rendererProps: Omit<CoverRendererProps, 'displaySrc' | 'positionX' | 'positionY'>;
}

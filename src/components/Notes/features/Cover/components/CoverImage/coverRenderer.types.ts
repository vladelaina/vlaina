import type { RefObject } from 'react';

export interface LoadedCoverMedia {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}

export interface CoverRendererProps {
  displaySrc: string;
  layoutPanelDragging?: boolean;
  isWindowResizing?: boolean;
  isContainerResizing?: boolean;
  placeholderSrc?: string | null;
  placeholderMediaSize?: { width: number; height: number } | null;
  isImageReady: boolean;
  isResizing: boolean;
  isResizeSettling: boolean;
  mediaSize: { width: number; height: number } | null;
  wrapperRef: RefObject<HTMLDivElement | null>;
  frozenImgRef: RefObject<HTMLImageElement | null>;
  frozenImageState: { top: number; left: number; width: number; height: number } | null;
  crop: { x: number; y: number };
  zoom: number;
  effectiveContainerSize: { width: number; height: number } | null;
  effectiveMinZoom: number;
  effectiveMaxZoom: number;
  objectFitMode: 'contain' | 'horizontal-cover' | 'vertical-cover';
  onCropperCropChange: (crop: { x: number; y: number }) => void;
  onCropperZoomChange: (zoom: number, anchor?: { x: number; y: number }) => void;
  onPointerIntent: (x?: number, y?: number) => void;
  onPointerMoveIntent: (x: number, y: number) => void;
  onNonPointerIntent: () => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  onMediaLoaded: (media: LoadedCoverMedia) => void;
  positionX: number;
  positionY: number;
}

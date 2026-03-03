export type Alignment = 'left' | 'center' | 'right';

export type ResizeDirection = 'left' | 'right' | 'top' | 'bottom' | 'bottom-left' | 'bottom-right';

export interface CropArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface CropperViewportState {
    crop: { x: number; y: number };
    zoom: number;
}

export interface LoadedMediaSize {
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
}

export type ImageNodeAttrs = Record<string, unknown>;

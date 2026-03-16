import { ImageViewerNavigationLab } from './playground/ImageViewerNavigationLab';

export const LAB_MODULES = [
  {
    id: 'image-viewer-navigation',
    label: 'Image Navigation',
    component: ImageViewerNavigationLab,
  }
] as const;

export type LabId = typeof LAB_MODULES[number]['id'];

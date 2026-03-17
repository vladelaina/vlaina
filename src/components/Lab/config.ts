import { ImageViewerNavigationLab } from './playground/ImageViewerNavigationLab';
import { AnimationLab } from './playground/AnimationLab';
import { AiToolbarDropdownLab } from './playground/AiToolbarDropdownLab';

export const LAB_MODULES = [
  {
    id: 'image-viewer-navigation',
    label: 'Image Navigation',
    component: ImageViewerNavigationLab,
  },
  {
    id: 'animation',
    label: 'AI Dropdown',
    icon: 'misc.animation',
    component: AnimationLab,
    description: 'Dropdown explorations for translation languages and AI action selection.',
  },
  {
    id: 'ai-toolbar-dropdown',
    label: 'Toolbar AI Menu',
    icon: 'misc.animation',
    component: AiToolbarDropdownLab,
    description: 'Dropdown explorations for the star button in the floating toolbar.',
  },
] as const;

export type LabId = typeof LAB_MODULES[number]['id'];

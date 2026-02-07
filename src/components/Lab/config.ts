import { MdAnimation, MdTextFields, MdPalette } from 'react-icons/md';
import { AnimationLab } from './playground/AnimationLab';

// Lab Registry: Add new experiments here
export const LAB_MODULES = [
  {
    id: 'animation',
    label: 'Motion & FX',
    icon: MdAnimation,
    component: AnimationLab,
    description: 'Loading indicators, transitions, and particle effects.'
  },
  // Example for future expansion:
  // {
  //   id: 'typography',
  //   label: 'Typography',
  //   icon: MdTextFields,
  //   component: TypographyLab
  // }
];

export type LabId = typeof LAB_MODULES[number]['id'];

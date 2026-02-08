import { MdAnimation, MdInput } from 'react-icons/md';
import { AnimationLab } from './playground/AnimationLab';
import { InputLab } from './playground/InputLab';

// Lab Registry: Add new experiments here
export const LAB_MODULES = [
  {
    id: 'animation',
    label: 'Motion & FX',
    icon: MdAnimation,
    component: AnimationLab,
    description: 'Loading indicators, transitions, and particle effects.'
  },
  {
    id: 'input',
    label: 'Input & Controls',
    icon: MdInput,
    component: InputLab,
    description: 'Chat input field styles, buttons, and interactions.'
  }
];

export type LabId = typeof LAB_MODULES[number]['id'];

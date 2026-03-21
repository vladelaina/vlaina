import { AnimationLab } from './playground/AnimationLab';
import { AiToolbarDropdownLab } from './playground/AiToolbarDropdownLab';
import { TopLeftEvolutionLab } from './playground/TopLeftEvolutionLab';

export const LAB_MODULES = [
  {
    id: 'top-left-evolution',
    label: 'Top-Left Evolution',
    icon: 'misc.animation',
    component: TopLeftEvolutionLab,
    description: '30 micro-architectural solutions for re-organizing top-left sidebar actions.'
  },
  {
    id: 'animation',
    label: 'AI Dropdown',
    icon: 'misc.animation',
    component: AnimationLab,
    description: 'Dropdown explorations for translation languages and AI action selection.'
  },
  {
    id: 'ai-toolbar-dropdown',
    label: 'Toolbar AI Menu',
    icon: 'misc.animation',
    component: AiToolbarDropdownLab,
    description: 'Dropdown explorations for the star button in the floating toolbar.'
  }
] as const;

export type LabId = typeof LAB_MODULES[number]['id'];

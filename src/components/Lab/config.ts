import { AnimationLab } from './playground/AnimationLab';
import { AiToolbarDropdownLab } from './playground/AiToolbarDropdownLab';
import { SidebarLab } from './playground/SidebarLab';

export const LAB_MODULES = [
  {
    id: 'sidebar-architect',
    label: 'Navigation Architecture',
    icon: 'misc.animation',
    component: SidebarLab,
    description: '30 structural concepts for the primary application navigation.'
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

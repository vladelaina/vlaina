import { AnimationLab } from './playground/AnimationLab';
import { AiToolbarDropdownLab } from './playground/AiToolbarDropdownLab';
import { ChatSidebarLoadingLab } from './playground/ChatSidebarLoadingLab';
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
  },
  {
    id: 'chat-sidebar-loading',
    label: 'Sidebar Loading',
    icon: 'misc.animation',
    component: ChatSidebarLoadingLab,
    description: 'Ten interaction directions for replacing the yellow in-progress dot in the chat sidebar.'
  }
] as const;

export type LabId = typeof LAB_MODULES[number]['id'];

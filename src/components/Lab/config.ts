import { AnimationLab } from './playground/AnimationLab';
import { AiToolbarDropdownLab } from './playground/AiToolbarDropdownLab';
import { LinkEditorLab } from './playground/LinkEditorLab';
import { TopLeftEvolutionLab } from './playground/TopLeftEvolutionLab';
import { CoreNavigationLab } from './playground/CoreNavigationLab';
import { SidebarResizeLab } from './playground/SidebarResizeLab';
import { FirstPrinciplesTableDrag } from './playground/FirstPrinciplesTableDrag';
import { FirstPrinciplesLinkEditor } from './playground/FirstPrinciplesLinkEditor';

export const LAB_MODULES = [
  {
    id: 'sidebar-resize',
    label: 'Sidebar Resize',
    icon: 'misc.animation',
    component: SidebarResizeLab,
    description: '30 interaction directions for improving sidebar drag feel, discovery, and commit behavior.'
  },
  {
    id: 'core-navigation',
    label: 'Navigation Director',
    icon: 'misc.animation',
    component: CoreNavigationLab,
    description: '30 Apple-style architectural solutions for Chat & Notes switching.'
  },
  {
    id: 'fp-table-drag',
    label: 'FP: Table Drag',
    icon: 'misc.lab',
    component: FirstPrinciplesTableDrag,
    description: '30 first-principles re-imaginings of table column reordering. Kinetic, grid-bound, and aesthetic models.'
  },
  {
    id: 'fp-link-editor',
    label: 'FP: Link Editor',
    icon: 'misc.lab',
    component: FirstPrinciplesLinkEditor,
    description: '50 first-principles directions for note link editing. From the 1px rail to the chrono-trace veil.'
  },
  {
    id: 'link-editor',
    label: 'Link Editor (Legacy)',
    icon: 'misc.lab',
    component: LinkEditorLab,
    description: 'Original GPT-style visual directions for comparison.'
  },
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

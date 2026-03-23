import { AnimationLab } from './playground/AnimationLab';
import { AiToolbarDropdownLab } from './playground/AiToolbarDropdownLab';
import { LinkEditorLab } from './playground/LinkEditorLab';
import { TopLeftEvolutionLab } from './playground/TopLeftEvolutionLab';
import { FirstPrinciplesTableDrag } from './playground/FirstPrinciplesTableDrag';
import { FirstPrinciplesLinkEditor } from './playground/FirstPrinciplesLinkEditor';

export const LAB_MODULES = [
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

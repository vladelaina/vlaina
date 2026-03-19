import { AnimationLab } from './playground/AnimationLab';
import { AiQuickActionsLab } from './playground/AiQuickActionsLab';
import { AiReviewLab } from './playground/AiReviewLab';
import { GoogleButtonLab } from './playground/GoogleButtonLab';
import { InputLab } from './playground/InputLab';
import { ShortcutDialogLab } from './playground/ShortcutDialogLab';
import { SidebarLoginEntryLab } from './playground/SidebarLoginEntryLab';
import { TableColumnDragLab } from './playground/TableColumnDragLab';

export const LAB_MODULES = [
  {
    id: 'shortcut-dialog',
    label: 'Shortcut Dialog',
    component: ShortcutDialogLab,
  },
  {
    id: 'animation',
    label: 'Motion & FX',
    icon: 'misc.animation',
    component: AnimationLab,
    description: 'Loading indicators, transitions, and particle effects.',
  },
  {
    id: 'sidebar-login-entry',
    label: 'Login Dialog',
    component: SidebarLoginEntryLab,
    description: 'Refined design directions for the sign-in dialog.',
  },
  {
    id: 'google-button-lab',
    label: 'Google Button',
    component: GoogleButtonLab,
    description: 'Thirty premium variants for the Google login action.',
  },
  {
    id: 'input',
    label: 'Input & Controls',
    icon: 'file.input',
    component: InputLab,
    description: 'Chat input field styles, buttons, and interactions.',
  },
  {
    id: 'ai-quick-actions',
    label: 'AI Quick Actions',
    icon: 'common.sparkle',
    component: AiQuickActionsLab,
    description: 'Prompt suggestions under the AI input.',
  },
  {
    id: 'ai-review',
    label: 'AI Review',
    icon: 'common.sparkle',
    component: AiReviewLab,
    description: 'Review surfaces for before-and-after AI edits.',
  },
  {
    id: 'table-column-drag',
    label: 'Table Drag',
    icon: 'misc.lab',
    component: TableColumnDragLab,
    description: 'Thirty interaction-led directions for a Notion-like table column drag handle.',
  },
] as const;

export type LabId = typeof LAB_MODULES[number]['id'];

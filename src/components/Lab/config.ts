import { AnimationLab } from './playground/AnimationLab';
import { AiQuickActionsLab } from './playground/AiQuickActionsLab';
import { AiReviewLab } from './playground/AiReviewLab';
import { InputLab } from './playground/InputLab';
import { ShortcutDialogLab } from './playground/ShortcutDialogLab';

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
    description: 'Loading indicators, transitions, and particle effects.'
  },
  {
    id: 'input',
    label: 'Input & Controls',
    icon: 'file.input',
    component: InputLab,
    description: 'Chat input field styles, buttons, and interactions.'
  },
  {
    id: 'ai-quick-actions',
    label: 'AI Quick Actions',
    icon: 'common.sparkle',
    component: AiQuickActionsLab,
    description: 'Prompt suggestions under the AI input.'
  },
  {
    id: 'ai-review',
    label: 'AI Review',
    icon: 'common.sparkle',
    component: AiReviewLab,
    description: 'Review surfaces for before-and-after AI edits.'
  }
] as const;

export type LabId = typeof LAB_MODULES[number]['id'];

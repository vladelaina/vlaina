import { ShortcutDialogLab } from './playground/ShortcutDialogLab';

export const LAB_MODULES = [
  {
    id: 'shortcut-dialog',
    label: 'Shortcut Dialog',
    component: ShortcutDialogLab,
  },
] as const;

export type LabId = typeof LAB_MODULES[number]['id'];

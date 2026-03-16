import { AI_QUICK_ACTION_VARIANTS } from './aiQuickActionVariantPresets';

export type AiQuickActionVariantLayout = 'wrap' | 'grid' | 'stack' | 'split' | 'rail';

export type AiQuickActionVariant = {
  id: string;
  name: string;
  description: string;
  layout: AiQuickActionVariantLayout;
  surfaceClassName: string;
  panelClassName: string;
  selectionShellClassName: string;
  selectionTextClassName: string;
  scopeClassName: string;
  inputShellClassName: string;
  promptClassName: string;
  actionsClassName: string;
  actionClassName: string;
  featuredActionClassName?: string;
  secondaryActionClassName?: string;
  sendButtonClassName: string;
  fontClassName?: string;
  iconClassName?: string;
  labelClassName?: string;
};

export const AI_QUICK_ACTION_SELECTION_TEXT =
  '你好世界';

export const AI_QUICK_ACTION_PROMPT =
  'Tell AI how to edit the selected text';

export const AI_QUICK_ACTION_SAMPLE_ACTIONS = [
  'Fix spelling',
  'Fix grammar',
  'Improve clarity',
  'Shorten',
];

export { AI_QUICK_ACTION_VARIANTS };

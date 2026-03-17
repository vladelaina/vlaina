import {
  AI_REVIEW_ACTION_COMMANDS,
  AI_REVIEW_TONE_COMMANDS,
  AI_REVIEW_TRANSLATE_COMMANDS,
} from '../../ai/constants';
import type { AiMenuGroup } from './types';

export const AI_MENU_GROUPS: readonly AiMenuGroup[] = [
  {
    id: 'translate',
    label: '翻译',
    items: AI_REVIEW_TRANSLATE_COMMANDS,
    tone: false,
  },
  {
    id: 'actions',
    label: '编辑',
    items: AI_REVIEW_ACTION_COMMANDS,
    tone: false,
  },
  {
    id: 'tone',
    label: '语气',
    items: AI_REVIEW_TONE_COMMANDS,
    tone: true,
  },
] as const;

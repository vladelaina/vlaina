import { PluginKey } from '@milkdown/kit/prose/state';
import type { SlashMenuState } from './types';

export const slashPluginKey = new PluginKey<SlashMenuState>('slashMenu');

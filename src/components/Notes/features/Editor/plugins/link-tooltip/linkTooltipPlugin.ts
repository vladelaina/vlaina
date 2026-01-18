
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';

// This file is deprecated. Please use linkTooltipPlugin.tsx.
// We export a dummy plugin to prevent crashes if this file is accidentally loaded.
export const linkTooltipPlugin = $prose(() => new Plugin({}));

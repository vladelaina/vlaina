import { PluginKey } from '@milkdown/kit/prose/state';

export const linkTooltipPluginKey = new PluginKey('link-tooltip');

export type LinkTooltipPluginState = {
    shouldShow: boolean;
    from: number;
    to: number;
    autoFocus: boolean;
};

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';

/**
 * Collapse Plugin - Placeholder
 * TODO: Implement heading collapse/fold functionality
 */
export const collapsePlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('collapse'),
  });
});

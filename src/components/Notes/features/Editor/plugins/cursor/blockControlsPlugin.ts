import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';
import { createBlockControlsPluginView } from './blockControlsPluginView';

export const blockControlsPluginKey = new PluginKey('blockControls');

export const blockControlsPlugin = $prose(() => {
  return new Plugin({
    key: blockControlsPluginKey,
    view(view) {
      return createBlockControlsPluginView(view);
    },
  });
});

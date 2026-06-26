import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { TypewriterModeView } from './typewriterModeView';

export const typewriterModePluginKey = new PluginKey('typewriterMode');

export const typewriterModePlugin = $prose(() => {
  return new Plugin({
    key: typewriterModePluginKey,
    view: (view) => new TypewriterModeView(view),
  });
});

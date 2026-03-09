import type { EditorView } from '@milkdown/kit/prose/view';
import { BlockControlsViewSession } from './blockControlsViewSession';

export function createBlockControlsPluginView(view: EditorView) {
  const session = new BlockControlsViewSession(view);
  return {
    update() {
      session.update();
    },
    destroy() {
      session.destroy();
    },
  };
}

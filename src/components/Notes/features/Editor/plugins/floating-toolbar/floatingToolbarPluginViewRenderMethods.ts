import type { FloatingToolbarPluginViewContext } from './floatingToolbarPluginViewTypes';
import { installFloatingToolbarPluginViewReviewRenderMethods } from './floatingToolbarPluginViewReviewRenderMethods';
import { installFloatingToolbarPluginViewToolbarRenderMethods } from './floatingToolbarPluginViewToolbarRenderMethods';

export function installFloatingToolbarPluginViewRenderMethods(ctx: FloatingToolbarPluginViewContext): void {
  installFloatingToolbarPluginViewToolbarRenderMethods(ctx);
  installFloatingToolbarPluginViewReviewRenderMethods(ctx);
}

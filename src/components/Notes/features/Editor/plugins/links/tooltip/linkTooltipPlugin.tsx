import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';
import { LinkTooltipView } from './LinkTooltipView';
import { linkTooltipPluginKey, type LinkTooltipPluginState } from './linkTooltipState';

export { linkTooltipPluginKey } from './linkTooltipState';

export const linkTooltipPlugin = $prose(() => {
    return new Plugin({
        key: linkTooltipPluginKey,
        state: {
            init: (): LinkTooltipPluginState => ({
                shouldShow: false,
                from: 0,
                to: 0,
                autoFocus: false,
            }),
            apply(tr, value) {
                const meta = tr.getMeta(linkTooltipPluginKey);

                if (meta?.type === 'SHOW_LINK_TOOLTIP') {
                    return {
                        ...value,
                        shouldShow: true,
                        from: meta.from,
                        to: meta.to,
                        autoFocus: meta.autoFocus === true,
                    };
                }

                if (meta?.type === 'CLEAR_LINK_TOOLTIP') {
                    return {
                        ...value,
                        shouldShow: false,
                        from: 0,
                        to: 0,
                        autoFocus: false,
                    };
                }

                return value;
            }
        },
        view(editorView) {
            const tooltipView = new LinkTooltipView(editorView);
            let pendingShowFrame: number | null = null;

            return {
                update(view, prevState) {
                    tooltipView.update(view, prevState);

                    const pluginState = linkTooltipPluginKey.getState(view.state);
                    if (!pluginState?.shouldShow) return;

                    const { from, to, autoFocus } = pluginState;
                    view.dispatch(view.state.tr.setMeta(linkTooltipPluginKey, { type: 'CLEAR_LINK_TOOLTIP' }));

                    if (pendingShowFrame != null) cancelAnimationFrame(pendingShowFrame);
                    pendingShowFrame = requestAnimationFrame(() => {
                        pendingShowFrame = null;
                        tooltipView.showAtPosition(from, to, autoFocus);
                    });
                },
                destroy() {
                    if (pendingShowFrame != null) cancelAnimationFrame(pendingShowFrame);
                    tooltipView.destroy();
                },
            };
        },
    });
});

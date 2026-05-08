import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { selectMarkdownTypewriterModeEnabled } from '@/stores/unified/settings/markdownSettings';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';

const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';

interface RectLike {
    top: number;
    bottom: number;
}

interface ScrollTargetMetrics {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    rootRect: RectLike;
    cursorRect: RectLike;
}

export const typewriterModePluginKey = new PluginKey('typewriterMode');

export function resolveTypewriterScrollTop({
    scrollTop,
    scrollHeight,
    clientHeight,
    rootRect,
    cursorRect,
}: ScrollTargetMetrics): number {
    const cursorCenter = (cursorRect.top + cursorRect.bottom) / 2;
    const rootCenter = (rootRect.top + rootRect.bottom) / 2;
    const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
    return Math.max(0, Math.min(maxScrollTop, scrollTop + cursorCenter - rootCenter));
}

function getScrollRoot(view: EditorView): HTMLElement | null {
    return view.dom.closest(SCROLL_ROOT_SELECTOR)
        ?? view.dom.ownerDocument.querySelector<HTMLElement>(SCROLL_ROOT_SELECTOR);
}

class TypewriterModeView {
    private enabled = selectMarkdownTypewriterModeEnabled(useUnifiedStore.getState());
    private frameId: number | null = null;
    private unsubscribe: (() => void) | null = null;

    constructor(private readonly view: EditorView) {
        this.unsubscribe = useUnifiedStore.subscribe((state) => {
            const nextEnabled = selectMarkdownTypewriterModeEnabled(state);
            if (this.enabled === nextEnabled) return;
            this.enabled = nextEnabled;
            if (nextEnabled && this.view.hasFocus()) {
                this.scheduleCenter();
            }
        });
    }

    update(view: EditorView, prevState: EditorView['state']): void {
        if (!this.enabled) return;
        if (!view.hasFocus()) return;
        if (!view.state.selection.eq(prevState.selection) || view.state.doc !== prevState.doc) {
            this.scheduleCenter();
        }
    }

    destroy(): void {
        if (this.frameId !== null) {
            this.view.dom.ownerDocument.defaultView?.cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        this.unsubscribe?.();
        this.unsubscribe = null;
    }

    private scheduleCenter(): void {
        if (this.frameId !== null) return;

        const ownerWindow = this.view.dom.ownerDocument.defaultView;
        if (!ownerWindow) return;

        this.frameId = ownerWindow.requestAnimationFrame(() => {
            this.frameId = null;
            this.centerCursor();
        });
    }

    private centerCursor(): void {
        if (!this.enabled) return;

        const scrollRoot = getScrollRoot(this.view);
        if (!scrollRoot) return;

        let cursorRect: RectLike;
        try {
            cursorRect = this.view.coordsAtPos(this.view.state.selection.head);
        } catch {
            return;
        }

        scrollRoot.scrollTop = resolveTypewriterScrollTop({
            scrollTop: scrollRoot.scrollTop,
            scrollHeight: scrollRoot.scrollHeight,
            clientHeight: scrollRoot.clientHeight,
            rootRect: scrollRoot.getBoundingClientRect(),
            cursorRect,
        });
    }
}

export const typewriterModePlugin = $prose(() => {
    return new Plugin({
        key: typewriterModePluginKey,
        view: (view) => new TypewriterModeView(view),
    });
});

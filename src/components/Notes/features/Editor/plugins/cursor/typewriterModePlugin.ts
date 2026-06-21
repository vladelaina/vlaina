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

export function shouldCenterTypewriterSelection(selection: { empty: boolean }): boolean {
    return selection.empty;
}

export function isTypewriterInputEvent(event: InputEvent): boolean {
    return event.inputType.startsWith('insert') || event.inputType.startsWith('delete');
}

export function isTypewriterKeyEvent(event: KeyboardEvent): boolean {
    if (event.isComposing) return false;

    if (event.key === 'Enter' || event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Tab') {
        return true;
    }

    if ((!event.metaKey && !event.ctrlKey) || event.altKey) {
        return false;
    }

    const key = event.key.toLowerCase();
    return key === 'z' || key === 'y';
}

function getScrollRoot(view: EditorView): HTMLElement | null {
    return view.dom.closest(SCROLL_ROOT_SELECTOR);
}

export class TypewriterModeView {
    private enabled = selectMarkdownTypewriterModeEnabled(useUnifiedStore.getState());
    private frameId: number | null = null;
    private unsubscribe: (() => void) | null = null;
    private pointerDown = false;
    private pendingInputCenter = false;

    constructor(private readonly view: EditorView) {
        this.unsubscribe = useUnifiedStore.subscribe((state) => {
            const nextEnabled = selectMarkdownTypewriterModeEnabled(state);
            if (this.enabled === nextEnabled) return;
            this.enabled = nextEnabled;
            if (!nextEnabled) {
                this.pendingInputCenter = false;
                this.cancelPendingFrame();
            }
        });
        this.view.dom.addEventListener('pointerdown', this.handlePointerDown);
        this.view.dom.addEventListener('beforeinput', this.handleBeforeInput);
        this.view.dom.addEventListener('keydown', this.handleKeyDown);
    }

    update(view: EditorView, prevState: EditorView['state']): void {
        if (!this.pendingInputCenter) return;

        this.pendingInputCenter = false;
        if (!this.enabled) return;
        if (!view.hasFocus()) return;
        if (this.pointerDown) return;
        if (!shouldCenterTypewriterSelection(view.state.selection)) return;
        if (view.state.doc !== prevState.doc) {
            this.scheduleCenter();
        }
    }

    destroy(): void {
        this.cancelPendingFrame();
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.view.dom.removeEventListener('pointerdown', this.handlePointerDown);
        this.view.dom.removeEventListener('beforeinput', this.handleBeforeInput);
        this.view.dom.removeEventListener('keydown', this.handleKeyDown);
        this.view.dom.ownerDocument.defaultView?.removeEventListener('pointerup', this.handlePointerUp);
        this.view.dom.ownerDocument.defaultView?.removeEventListener('pointercancel', this.handlePointerUp);
    }

    private handleBeforeInput = (event: Event): void => {
        if (!this.enabled) return;
        if (!(event instanceof InputEvent)) return;
        if (!isTypewriterInputEvent(event)) return;
        this.pendingInputCenter = true;
    };

    private handleKeyDown = (event: KeyboardEvent): void => {
        if (!this.enabled) return;
        if (!isTypewriterKeyEvent(event)) return;
        this.pendingInputCenter = true;
    };

    private handlePointerDown = (): void => {
        this.pointerDown = true;
        this.pendingInputCenter = false;
        this.cancelPendingFrame();

        const ownerWindow = this.view.dom.ownerDocument.defaultView;
        ownerWindow?.addEventListener('pointerup', this.handlePointerUp, { once: true });
        ownerWindow?.addEventListener('pointercancel', this.handlePointerUp, { once: true });
    };

    private handlePointerUp = (): void => {
        this.pointerDown = false;
        const ownerWindow = this.view.dom.ownerDocument.defaultView;
        ownerWindow?.removeEventListener('pointerup', this.handlePointerUp);
        ownerWindow?.removeEventListener('pointercancel', this.handlePointerUp);
    };

    private scheduleCenter(): void {
        if (this.frameId !== null) return;

        const ownerWindow = this.view.dom.ownerDocument.defaultView;
        if (!ownerWindow) return;

        this.frameId = ownerWindow.requestAnimationFrame(() => {
            this.frameId = null;
            this.centerCursor();
        });
    }

    private cancelPendingFrame(): void {
        if (this.frameId === null) return;
        this.view.dom.ownerDocument.defaultView?.cancelAnimationFrame(this.frameId);
        this.frameId = null;
    }

    private centerCursor(): void {
        if (!this.enabled) return;
        if (this.pointerDown) return;
        if (!shouldCenterTypewriterSelection(this.view.state.selection)) return;

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

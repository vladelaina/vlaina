import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { applyLinkTooltipPositionSpy, cleanupEventsSpy } = vi.hoisted(() => ({
    applyLinkTooltipPositionSpy: vi.fn(),
    cleanupEventsSpy: vi.fn(),
}));

vi.mock('./linkTooltipPositioning', () => ({
    applyLinkTooltipPosition: applyLinkTooltipPositionSpy,
    getLinkTooltipPositionRoot: () => null,
}));

vi.mock('./linkTooltipEvents', () => ({
    installLinkTooltipEvents: () => cleanupEventsSpy,
}));

vi.mock('./LinkTooltip', () => ({
    default: () => null,
}));

import { LinkTooltipView } from './LinkTooltipView';

class ResizeObserverMock {
    static instances: ResizeObserverMock[] = [];

    callback: ResizeObserverCallback;
    observe = vi.fn();
    disconnect = vi.fn();

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        ResizeObserverMock.instances.push(this);
    }
}

class MutationObserverMock {
    static instances: MutationObserverMock[] = [];

    callback: MutationCallback;
    observe = vi.fn();
    disconnect = vi.fn();

    constructor(callback: MutationCallback) {
        this.callback = callback;
        MutationObserverMock.instances.push(this);
    }
}

function createView() {
    const editor = document.createElement('div');
    document.body.append(editor);
    return {
        dom: editor,
        state: {
            selection: {
                $from: { pos: 1 },
                eq: () => true,
            },
        },
        focus: vi.fn(),
    } as any;
}

describe('LinkTooltipView', () => {
    beforeEach(() => {
        ResizeObserverMock.instances = [];
        MutationObserverMock.instances = [];
        applyLinkTooltipPositionSpy.mockClear();
        cleanupEventsSpy.mockClear();
        vi.stubGlobal('ResizeObserver', ResizeObserverMock);
        vi.stubGlobal('MutationObserver', MutationObserverMock);
    });

    afterEach(() => {
        document.documentElement.removeAttribute('data-link-tooltip-hover-active');
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('marks the tooltip container as non-editor chrome for blank-area pointer handling', () => {
        const view = new LinkTooltipView(createView());

        expect(view.dom.getAttribute('data-no-editor-drag-box')).toBe('true');

        view.destroy();
    });

    it('coalesces observer-driven reposition work into one animation frame', () => {
        const rafCallbacks = new Map<number, FrameRequestCallback>();
        let nextRafId = 1;
        const requestAnimationFrameSpy = vi
            .spyOn(window, 'requestAnimationFrame')
            .mockImplementation((callback: FrameRequestCallback) => {
                const id = nextRafId;
                nextRafId += 1;
                rafCallbacks.set(id, callback);
                return id;
            });
        const cancelAnimationFrameSpy = vi
            .spyOn(window, 'cancelAnimationFrame')
            .mockImplementation((id: number) => {
                rafCallbacks.delete(id);
            });
        const view = new LinkTooltipView(createView());
        const link = document.createElement('a');
        view.view.dom.append(link);
        view.activeLink = link;
        view.activeAnchor = { type: 'link', link };
        view.dom.classList.remove('hidden');
        (view as any).observePositionDependencies();

        ResizeObserverMock.instances[0]!.callback([], ResizeObserverMock.instances[0] as unknown as ResizeObserver);
        ResizeObserverMock.instances[0]!.callback([], ResizeObserverMock.instances[0] as unknown as ResizeObserver);
        MutationObserverMock.instances[0]!.callback([], MutationObserverMock.instances[0] as unknown as MutationObserver);

        expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
        expect(applyLinkTooltipPositionSpy).not.toHaveBeenCalled();

        const callbacks = Array.from(rafCallbacks.values());
        rafCallbacks.clear();
        callbacks.forEach((callback) => callback(0));

        expect(applyLinkTooltipPositionSpy).toHaveBeenCalledTimes(1);
        view.destroy();
        requestAnimationFrameSpy.mockRestore();
        cancelAnimationFrameSpy.mockRestore();
    });

    it('cancels pending observer reposition work when hidden', () => {
        const requestAnimationFrameSpy = vi
            .spyOn(window, 'requestAnimationFrame')
            .mockImplementation(() => 7);
        const cancelAnimationFrameSpy = vi
            .spyOn(window, 'cancelAnimationFrame')
            .mockImplementation(() => {});
        const view = new LinkTooltipView(createView());
        const link = document.createElement('a');
        view.view.dom.append(link);
        view.activeLink = link;
        view.activeAnchor = { type: 'link', link };
        view.dom.classList.remove('hidden');

        view.scheduleReposition();
        view.hide(true);

        expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
        expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(7);
        view.destroy();
        requestAnimationFrameSpy.mockRestore();
        cancelAnimationFrameSpy.mockRestore();
    });

    it('hides editor carets only while a pointer-triggered link tooltip is visible', () => {
        const view = new LinkTooltipView(createView());
        const link = document.createElement('a');
        link.href = 'https://example.test';
        view.view.dom.append(link);

        view.show(link, true);

        expect(document.documentElement).toHaveAttribute('data-link-tooltip-hover-active', 'true');

        view.hide(true);

        expect(document.documentElement).not.toHaveAttribute('data-link-tooltip-hover-active');

        view.show(link);

        expect(document.documentElement).not.toHaveAttribute('data-link-tooltip-hover-active');
        view.destroy();
    });
});

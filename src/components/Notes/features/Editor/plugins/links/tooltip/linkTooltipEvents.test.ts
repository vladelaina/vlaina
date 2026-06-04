import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installLinkTooltipEvents } from './linkTooltipEvents';
import { openEditorLinkHref } from '../utils/openEditorLinkHref';

vi.mock('../utils/openEditorLinkHref', () => ({
    openEditorLinkHref: vi.fn(async () => undefined),
}));

function createHandlers() {
    const editorDom = document.createElement('div');
    const tooltipDom = document.createElement('div');
    const handlers = {
        view: { dom: editorDom } as any,
        dom: tooltipDom,
        showLinkWithDelay: vi.fn(),
        hide: vi.fn(),
        scheduleFocus: vi.fn(),
        reposition: vi.fn(),
        clearHideTimer: vi.fn(),
        startHideTimer: vi.fn(),
        clearShowTimer: vi.fn(),
        setKeyboardInteraction: vi.fn(),
        hasActiveLink: vi.fn(() => false),
    };

    return { editorDom, handlers };
}

async function flushAsyncHandlers() {
    await Promise.resolve();
}

describe('installLinkTooltipEvents', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('opens keyboard-activated editor links through the shared link opener', async () => {
        const { editorDom, handlers } = createHandlers();
        const link = document.createElement('a');
        link.href = 'http://127.0.0.1:3000/private.md';
        link.textContent = 'local';
        editorDom.appendChild(link);

        const cleanup = installLinkTooltipEvents(handlers);
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            detail: 0,
        });

        link.dispatchEvent(event);
        await flushAsyncHandlers();

        expect(event.defaultPrevented).toBe(true);
        expect(openEditorLinkHref).toHaveBeenCalledWith('http://127.0.0.1:3000/private.md', {
            view: handlers.view,
        });

        cleanup();
    });

    it('does not open mouse-activated editor links twice on the follow-up click', async () => {
        const { editorDom, handlers } = createHandlers();
        const link = document.createElement('a');
        link.href = 'https://example.com/docs';
        link.textContent = 'docs';
        editorDom.appendChild(link);

        const cleanup = installLinkTooltipEvents(handlers);
        const mouseDown = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            detail: 1,
        });
        const click = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            detail: 1,
        });

        link.dispatchEvent(mouseDown);
        link.dispatchEvent(click);
        await flushAsyncHandlers();

        expect(mouseDown.defaultPrevented).toBe(true);
        expect(click.defaultPrevented).toBe(true);
        expect(openEditorLinkHref).toHaveBeenCalledTimes(1);
        expect(openEditorLinkHref).toHaveBeenCalledWith('https://example.com/docs', {
            view: handlers.view,
        });

        cleanup();
    });
});

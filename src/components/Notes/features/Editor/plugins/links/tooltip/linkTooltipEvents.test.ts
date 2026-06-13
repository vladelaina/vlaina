import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installLinkTooltipEvents } from './linkTooltipEvents';
import { floatingToolbarKey } from '../../floating-toolbar/floatingToolbarKey';
import { TOOLBAR_ACTIONS } from '../../floating-toolbar/types';
import { openEditorLinkHref } from '../utils/openEditorLinkHref';

const stateMocks = vi.hoisted(() => ({
    selectionNear: vi.fn(),
    textSelectionCreate: vi.fn(),
}));

vi.mock('@milkdown/kit/prose/state', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@milkdown/kit/prose/state')>();
    return {
        ...actual,
        Selection: {
            ...actual.Selection,
            near: stateMocks.selectionNear,
        },
        TextSelection: {
            ...actual.TextSelection,
            create: stateMocks.textSelectionCreate,
        },
    };
});

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
        stateMocks.selectionNear.mockReset();
        stateMocks.textSelectionCreate.mockReset();
        stateMocks.selectionNear.mockReturnValue({ type: 'near-selection' });
        stateMocks.textSelectionCreate.mockReturnValue({ type: 'text-selection' });
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

    it('hides the tooltip and collapses selected editor text when clicking non-link content', () => {
        const { editorDom, handlers } = createHandlers();
        const blankText = document.createElement('span');
        const doc = {
            content: { size: 40 },
            resolve: vi.fn((pos: number) => ({ pos })),
        };
        const tr = {
            doc,
            setMeta: vi.fn(() => tr),
            setSelection: vi.fn(() => tr),
        };
        handlers.view = {
            dom: editorDom,
            state: {
                doc,
                selection: {
                    from: 3,
                    to: 8,
                    empty: false,
                },
                tr,
            },
            dispatch: vi.fn(),
            focus: vi.fn(),
            posAtCoords: vi.fn(() => ({ pos: 12 })),
        } as any;
        editorDom.appendChild(blankText);

        const cleanup = installLinkTooltipEvents(handlers);
        const mouseDown = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: 7,
            clientY: 11,
        });

        blankText.dispatchEvent(mouseDown);

        expect(mouseDown.defaultPrevented).toBe(true);
        expect(handlers.setKeyboardInteraction).toHaveBeenCalledWith(false);
        expect(handlers.hide).toHaveBeenCalledWith(true);
        expect(handlers.view.posAtCoords).toHaveBeenCalledWith({ left: 7, top: 11 });
        expect(stateMocks.textSelectionCreate).toHaveBeenCalledWith(doc, 12);
        expect(tr.setSelection).toHaveBeenCalledWith({ type: 'text-selection' });
        expect(tr.setMeta).toHaveBeenCalledWith(floatingToolbarKey, { type: TOOLBAR_ACTIONS.HIDE });
        expect(tr.setMeta).toHaveBeenCalledWith('addToHistory', false);
        expect(handlers.view.dispatch).toHaveBeenCalledWith(tr);
        expect(handlers.view.focus).toHaveBeenCalled();

        cleanup();
    });

    it('falls back to the selected range end when the clicked point is not a text cursor', () => {
        const { editorDom, handlers } = createHandlers();
        const blankText = document.createElement('span');
        const doc = {
            content: { size: 40 },
            resolve: vi.fn((pos: number) => ({ pos })),
        };
        const tr = {
            doc,
            setMeta: vi.fn(() => tr),
            setSelection: vi.fn(() => tr),
        };
        stateMocks.textSelectionCreate
            .mockImplementationOnce(() => {
                throw new Error('not a text cursor');
            })
            .mockReturnValue({ type: 'text-selection' });
        handlers.view = {
            dom: editorDom,
            state: {
                doc,
                selection: {
                    from: 3,
                    to: 8,
                    empty: false,
                },
                tr,
            },
            dispatch: vi.fn(),
            focus: vi.fn(),
            posAtCoords: vi.fn(() => ({ pos: 39 })),
        } as any;
        editorDom.appendChild(blankText);

        const cleanup = installLinkTooltipEvents(handlers);

        blankText.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: 7,
            clientY: 11,
        }));

        expect(stateMocks.textSelectionCreate).toHaveBeenNthCalledWith(1, doc, 39);
        expect(stateMocks.textSelectionCreate).toHaveBeenNthCalledWith(2, doc, 8);
        expect(tr.setSelection).toHaveBeenCalledWith({ type: 'text-selection' });
        expect(handlers.view.dispatch).toHaveBeenCalledWith(tr);

        cleanup();
    });
});

import { cleanup, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LinkTooltip from './LinkTooltip';

vi.mock('./components/LinkEditor', () => ({
    LinkEditor: () => <div data-testid="link-editor" />,
}));

vi.mock('./components/LinkViewer', () => ({
    LinkViewer: () => <div data-testid="link-viewer" />,
}));

function renderInTooltipContainer(props: Partial<ComponentProps<typeof LinkTooltip>> = {}) {
    const container = document.createElement('div');
    container.className = 'link-tooltip-container';
    document.body.append(container);

    const onEdit = vi.fn();
    const onClose = vi.fn();
    const onOpen = vi.fn();
    const onUnlink = vi.fn();
    const onRemove = vi.fn();

    render(
        <LinkTooltip
            href=""
            initialText="Link target"
            onEdit={onEdit}
            onClose={onClose}
            onOpen={onOpen}
            onUnlink={onUnlink}
            onRemove={onRemove}
            containerElement={container}
            {...props}
        />,
        { container }
    );

    return {
        container,
        onClose,
        onEdit,
    };
}

function dispatchStoppedEditorMouseDown() {
    const editorBlank = document.createElement('div');
    document.body.append(editorBlank);
    editorBlank.addEventListener('mousedown', (event) => {
        event.stopPropagation();
    });

    editorBlank.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
    }));
}

describe('LinkTooltip', () => {
    afterEach(() => {
        cleanup();
        document.body.replaceChildren();
    });

    it('handles an editing tooltip before an editor blank click can stop propagation', () => {
        const { onEdit, onClose } = renderInTooltipContainer();

        dispatchStoppedEditorMouseDown();

        expect(onEdit).toHaveBeenCalledWith('Link target', '', true);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('closes a viewing tooltip before an editor blank click can stop propagation', () => {
        const { onClose, onEdit } = renderInTooltipContainer({
            href: 'https://example.com/docs',
            initialText: 'Docs',
        });

        dispatchStoppedEditorMouseDown();

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onEdit).not.toHaveBeenCalled();
    });

    it('treats a non-element event target outside the tooltip as an outside click', () => {
        const { onEdit } = renderInTooltipContainer();
        const textNode = document.createTextNode('outside text');
        document.body.append(textNode);

        textNode.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
        }));

        expect(onEdit).toHaveBeenCalledWith('Link target', '', true);
    });

    it('handles pointerdown outside before editor mousedown handlers can intercept the click', () => {
        const { onEdit } = renderInTooltipContainer();
        const editorBlank = document.createElement('div');
        document.body.append(editorBlank);

        editorBlank.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
        }));
        editorBlank.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
        }));

        expect(onEdit).toHaveBeenCalledTimes(1);
        expect(onEdit).toHaveBeenCalledWith('Link target', '', true);
    });

    it('uses its own tooltip container when another tooltip container is still in the document', () => {
        const staleContainer = document.createElement('div');
        staleContainer.className = 'link-tooltip-container';
        const staleBlank = document.createElement('div');
        staleContainer.append(staleBlank);
        document.body.append(staleContainer);

        const { container, onEdit } = renderInTooltipContainer();

        expect(staleContainer.hasAttribute('data-editing')).toBe(false);
        expect(container.getAttribute('data-editing')).toBe('true');

        staleBlank.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
        }));

        expect(onEdit).toHaveBeenCalledWith('Link target', '', true);
        expect(container.hasAttribute('data-editing')).toBe(false);
    });
});

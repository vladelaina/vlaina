import { themeRenderingTokens } from '@/styles/themeTokens';

export function applyLinkTooltipEditorWhitespace(editorDom: HTMLElement) {
    editorDom.style.whiteSpace = themeRenderingTokens.whiteSpacePreWrap;
}

export function createLinkTooltipContainer(positionRoot: HTMLElement | null) {
    const dom = document.createElement('div');
    dom.className = 'link-tooltip-container absolute hidden z-[var(--vlaina-z-50)]';
    dom.setAttribute('data-no-editor-drag-box', 'true');
    (positionRoot ?? document.body).appendChild(dom);
    return dom;
}

export function createLinkTooltipResizeObserver(callback: () => void) {
    return typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(callback)
        : null;
}

export function createLinkTooltipMutationObserver(callback: () => void) {
    return typeof MutationObserver !== 'undefined'
        ? new MutationObserver(callback)
        : null;
}

export function focusLinkTooltipEditor(dom: HTMLElement) {
    const input = dom.querySelector<HTMLTextAreaElement>('textarea');
    if (!input?.isConnected) return;

    input.focus({ preventScroll: true });
    if (document.activeElement === input) {
        input.select();
    }
}

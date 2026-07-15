const LINK_TOOLTIP_HOVER_ACTIVE_ATTRIBUTE = 'data-link-tooltip-hover-active';

const activeOwners = new Set<HTMLElement>();

export function setLinkTooltipHoverCaretHidden(owner: HTMLElement, hidden: boolean): void {
    if (hidden) {
        activeOwners.add(owner);
    } else {
        activeOwners.delete(owner);
    }

    const ownerDocument = owner.ownerDocument;
    let hasActiveOwner = false;
    for (const activeOwner of activeOwners) {
        if (!activeOwner.isConnected) {
            activeOwners.delete(activeOwner);
            continue;
        }
        if (activeOwner.ownerDocument === ownerDocument) {
            hasActiveOwner = true;
        }
    }

    if (hasActiveOwner) {
        ownerDocument.documentElement.setAttribute(LINK_TOOLTIP_HOVER_ACTIVE_ATTRIBUTE, 'true');
    } else {
        ownerDocument.documentElement.removeAttribute(LINK_TOOLTIP_HOVER_ACTIVE_ATTRIBUTE);
    }
}

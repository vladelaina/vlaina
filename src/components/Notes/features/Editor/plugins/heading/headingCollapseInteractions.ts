import { type PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { parseCollapseMetaAction, type CollapseMetaAction } from './headingCollapseState';
import {
    findCollapsedSectionAtOrBoundaryPos,
    findCollapsedSectionByBoundaryPos,
    resolveExpandedSectionTailPos,
    resolveTailRedirectPos,
    setSelectionAtPos,
} from './headingCollapseSelection';
import {
    findCollapsedRangeContainingPos,
    findCollapsedRangeIntersectingSelection,
    findCollapsedSectionByHeading,
    type CollapsedSection,
} from './headingCollapseUtils';
import type { HeadingCollapsePluginState } from './headingCollapsePluginState';

interface HeadingCollapseInteractionOptions {
    pluginKey: PluginKey<HeadingCollapsePluginState>;
    selectionGuardMeta: string;
}

function createExpandAndRedirectTransaction(
    state: any,
    headingPos: number,
    section: CollapsedSection,
    { pluginKey, selectionGuardMeta }: HeadingCollapseInteractionOptions,
) {
    const tr = state.tr;
    tr.setMeta(pluginKey, { type: 'expand', headingPos } satisfies CollapseMetaAction);

    const docEnd = tr.doc.content.size;
    const endsAtDocumentTail = section.to >= docEnd;
    const paragraphType = tr.doc.type.schema.nodes.paragraph;

    if (endsAtDocumentTail && paragraphType) {
        const lastNode = tr.doc.lastChild;
        const hasTailEmptyParagraph =
            lastNode?.type?.name === 'paragraph' && lastNode.content?.size === 0;

        if (hasTailEmptyParagraph) {
            setSelectionAtPos(tr, Math.max(0, docEnd - 1), -1);
        } else {
            tr.insert(docEnd, paragraphType.create());
            setSelectionAtPos(tr, docEnd + 1, 1);
        }
    } else {
        setSelectionAtPos(tr, resolveExpandedSectionTailPos(section), -1);
    }

    tr.setMeta(selectionGuardMeta, true);
    return tr.scrollIntoView();
}

function createExpandWithoutRedirectTransaction(
    state: any,
    headingPos: number,
    { pluginKey, selectionGuardMeta }: HeadingCollapseInteractionOptions,
) {
    const tr = state.tr;
    tr.setMeta(pluginKey, { type: 'expand', headingPos } satisfies CollapseMetaAction);
    tr.setMeta(selectionGuardMeta, true);
    return tr;
}

export function expandCollapsedHeadingSectionAtPos(
    view: EditorView,
    pos: number,
    options: HeadingCollapseInteractionOptions,
): boolean {
    const pluginState = options.pluginKey.getState(view.state);
    if (!pluginState || pluginState.collapsedHeadings.size === 0) {
        return false;
    }

    const collapsedRange = findCollapsedRangeContainingPos(pluginState.collapsedRanges, pos);
    if (!collapsedRange) {
        return false;
    }

    view.dispatch(createExpandWithoutRedirectTransaction(view.state, collapsedRange.headingPos, options));
    return true;
}

export function createHeadingCollapseAppendTransaction(
    transactions: readonly any[],
    newState: any,
    options: HeadingCollapseInteractionOptions,
) {
    if (transactions.some((tr) => tr.getMeta(options.selectionGuardMeta))) {
        return null;
    }

    const pluginState = options.pluginKey.getState(newState);
    if (!pluginState || pluginState.collapsedHeadings.size === 0) return null;

    const hasRelevantChange = transactions.some((tr) => {
        const action = parseCollapseMetaAction(tr.getMeta(options.pluginKey));
        return tr.docChanged || tr.selectionSet || !!action;
    });
    if (!hasRelevantChange) return null;

    const collapsedRanges = pluginState.collapsedRanges;
    if (collapsedRanges.length === 0) return null;

    const collapseAction = transactions
        .map((tr) => parseCollapseMetaAction(tr.getMeta(options.pluginKey)))
        .find((action): action is CollapseMetaAction => !!action && action.type === 'collapse');

    if (collapseAction) {
        const collapsedSection = findCollapsedSectionByHeading(collapsedRanges, collapseAction.headingPos);
        if (collapsedSection) {
            const { from, to, empty } = newState.selection;
            const intersectsCollapsedSection = empty
                ? from >= collapsedSection.from && from <= collapsedSection.to
                : to > collapsedSection.from && from < collapsedSection.to;

            if (intersectsCollapsedSection) {
                const tr = newState.tr;
                const targetPos = resolveTailRedirectPos(
                    newState.doc,
                    collapseAction.headingPos,
                    collapsedSection.from,
                );
                const redirectResult = setSelectionAtPos(tr, targetPos, -1);
                if (redirectResult.changed) {
                    tr.setMeta(options.selectionGuardMeta, true);
                    return tr.scrollIntoView();
                }
            }
        }
    }

    const { from, to, empty } = newState.selection;
    const collapsedRange = empty
        ? findCollapsedRangeContainingPos(collapsedRanges, from)
        : findCollapsedRangeIntersectingSelection(collapsedRanges, from, to);

    if (!collapsedRange) {
        if (!empty) return null;

        const sectionAtBoundary = findCollapsedSectionByBoundaryPos(collapsedRanges, from);
        if (!sectionAtBoundary) return null;
        return createExpandAndRedirectTransaction(
            newState,
            sectionAtBoundary.headingPos,
            sectionAtBoundary,
            options,
        );
    }

    const section = findCollapsedSectionAtOrBoundaryPos(collapsedRanges, collapsedRange.from);
    if (!section) return null;

    const docEnd = newState.doc.content.size;
    const isTailCollapsedSection = section.to >= docEnd;
    if (empty && isTailCollapsedSection && from >= section.from && from <= section.to) {
        return createExpandAndRedirectTransaction(newState, collapsedRange.headingPos, section, options);
    }

    if (empty && from === section.to) {
        return createExpandAndRedirectTransaction(newState, collapsedRange.headingPos, section, options);
    }

    const redirectTargetPos = section.to < docEnd
        ? section.to
        : resolveTailRedirectPos(newState.doc, collapsedRange.headingPos, section.from);
    const redirectBias: 1 | -1 = section.to < docEnd ? 1 : -1;

    const tr = newState.tr;
    const redirectResult = setSelectionAtPos(tr, redirectTargetPos, redirectBias);
    if (!redirectResult.changed) return null;

    tr.setMeta(options.selectionGuardMeta, true);
    return tr.scrollIntoView();
}

export function handleHeadingCollapseMouseDown(
    view: EditorView,
    event: Event,
    options: HeadingCollapseInteractionOptions,
): boolean {
    if (!(event instanceof MouseEvent)) return false;
    if (!(event.target instanceof Node)) return false;
    if (!view.dom.contains(event.target)) return false;

    const pluginState = options.pluginKey.getState(view.state);
    if (!pluginState || pluginState.collapsedHeadings.size === 0) return false;

    const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (!coords) return false;

    const section = findCollapsedSectionAtOrBoundaryPos(pluginState.collapsedRanges, coords.pos);
    if (!section) return false;

    const headingDom = view.nodeDOM(section.headingPos) as HTMLElement | null;
    if (!headingDom) return false;
    const headingRect = headingDom.getBoundingClientRect();
    if (event.clientY <= headingRect.bottom) return false;

    const tr = createExpandWithoutRedirectTransaction(view.state, section.headingPos, options);
    view.dispatch(tr);
    view.focus();
    event.preventDefault();
    return true;
}

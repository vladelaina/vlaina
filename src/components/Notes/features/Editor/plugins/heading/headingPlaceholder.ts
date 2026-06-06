import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { getDefaultHeadingPlaceholderText } from './headingPlaceholderText';
import {
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../shared/boundedProseNodeScan';

export const MAX_HEADING_PLACEHOLDER_DECORATIONS = 1000;

export const getHeadingPlaceholder = (rawLevel: number): string => {
    return getDefaultHeadingPlaceholderText(rawLevel);
};

export const createHeadingPlaceholderDecorations = (doc: any): DecorationSet => {
    const decorations: Decoration[] = [];

    scanProseDescendants(doc, (node, pos) => {
        if (decorations.length >= MAX_HEADING_PLACEHOLDER_DECORATIONS) return STOP_PROSE_SCAN;
        if (node.type?.name !== 'heading') return true;
        if (node.content?.size !== 0) return true;
        if (typeof node.nodeSize !== 'number') return true;

        decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
                class: 'is-editor-empty',
                'data-placeholder': getHeadingPlaceholder(Number(node.attrs?.level ?? 1)),
            }),
        );

        return decorations.length < MAX_HEADING_PLACEHOLDER_DECORATIONS ? true : STOP_PROSE_SCAN;
    });

    return DecorationSet.create(doc, decorations);
};

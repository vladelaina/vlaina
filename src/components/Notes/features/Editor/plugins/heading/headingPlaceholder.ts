import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { getDefaultHeadingPlaceholderText } from './headingPlaceholderText';

const MAX_HEADING_PLACEHOLDER_DECORATIONS = 1000;

export const getHeadingPlaceholder = (rawLevel: number): string => {
    return getDefaultHeadingPlaceholderText(rawLevel);
};

export const createHeadingPlaceholderDecorations = (doc: any): DecorationSet => {
    const decorations: Decoration[] = [];

    doc.descendants((node: any, pos: number) => {
        if (decorations.length >= MAX_HEADING_PLACEHOLDER_DECORATIONS) return false;
        if (node.type.name !== 'heading') return true;
        if (node.content.size !== 0) return true;

        decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
                class: 'is-editor-empty',
                'data-placeholder': getHeadingPlaceholder(Number(node.attrs?.level ?? 1)),
            }),
        );

        return decorations.length < MAX_HEADING_PLACEHOLDER_DECORATIONS;
    });

    return DecorationSet.create(doc, decorations);
};

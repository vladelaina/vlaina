import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { getDefaultHeadingPlaceholderText } from './headingPlaceholderText';

export const getHeadingPlaceholder = (rawLevel: number): string => {
    return getDefaultHeadingPlaceholderText(rawLevel);
};

export const createHeadingPlaceholderDecorations = (doc: any): DecorationSet => {
    const decorations: Decoration[] = [];

    doc.descendants((node: any, pos: number) => {
        if (node.type.name !== 'heading') return true;
        if (node.content.size !== 0) return true;

        decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
                class: 'is-editor-empty',
                'data-placeholder': getHeadingPlaceholder(Number(node.attrs?.level ?? 1)),
            }),
        );

        return true;
    });

    return DecorationSet.create(doc, decorations);
};

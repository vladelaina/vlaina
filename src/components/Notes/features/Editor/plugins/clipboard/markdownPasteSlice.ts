import { Fragment, Slice, type Node as ProseNode } from '@milkdown/kit/prose/model';

type TextSelectionState = {
    selection: {
        $from: {
            parent: {
                isTextblock: boolean;
            };
        };
        $to: {
            parent: unknown;
        };
    };
};

export const hasOnlyParagraphNodes = (nodes: ProseNode[]) => nodes.length > 0
    && nodes.every((node) => node.type.name === 'paragraph');

export const shouldInlineParagraphMarkdownPaste = (
    state: TextSelectionState,
    nodes: ProseNode[],
) => nodes.length === 1
    && nodes[0].type.name === 'paragraph'
    && state.selection.$from.parent.isTextblock
    && state.selection.$from.parent === state.selection.$to.parent;

export const createMarkdownPasteSlice = (
    state: TextSelectionState,
    nodes: ProseNode[],
) => shouldInlineParagraphMarkdownPaste(state, nodes)
    ? new Slice(nodes[0].content as Slice['content'], 0, 0)
    : new Slice(Fragment.fromArray(nodes), 0, 0);

import type { Ctx } from '@milkdown/kit/ctx';
import {
    footnoteDefinitionSchema,
    footnoteReferenceSchema,
} from '@milkdown/kit/preset/gfm';
import { updateSchemaFactory } from './themeSchemaUtils';
import { normalizeFootnoteLabel } from './plugins/footnote/footnoteLabels';

export function applyFootnoteSchemaOverrides(ctx: Ctx) {
    updateSchemaFactory(ctx, footnoteReferenceSchema.key, (prev: any) => ({
        ...prev,
        parseDOM: [
            {
                tag: 'sup.footnote-ref',
                getAttrs: (dom: HTMLElement) => ({
                    label: normalizeFootnoteLabel(dom.dataset.id || dom.dataset.label),
                }),
            },
            ...(prev.parseDOM || []),
        ],
        parseMarkdown: {
            match: (node: any) => prev.parseMarkdown?.match?.(node) ?? node.type === 'footnoteReference',
            runner: (state: any, node: any, type: any) => {
                const label = normalizeFootnoteLabel(node.label || node.identifier);
                if (!label) return;
                state.addNode(type, { label });
            },
        },
        toMarkdown: {
            match: (node: any) => node.type.name === 'footnote_reference',
            runner: (state: any, node: any) => {
                const label = normalizeFootnoteLabel(node.attrs.label);
                if (!label) return;
                state.addNode('footnoteReference', undefined, undefined, { label, identifier: label });
            },
        },
        toDOM: (node: any) => {
            const label = normalizeFootnoteLabel(node.attrs.label);
            const displayLabel = `[${label}]`;

            return [
                'sup',
                {
                    class: 'footnote-ref md-footnote',
                    'data-id': label,
                    'data-label': label,
                    'data-type': 'footnote_reference',
                    'data-footnote-value': displayLabel,
                    'aria-label': `Footnote ${label}`,
                    contenteditable: 'false',
                },
                ['span', { class: 'footnote-ref-label', contenteditable: 'false' }, displayLabel],
            ];
        },
    }));

    updateSchemaFactory(ctx, footnoteDefinitionSchema.key, (prev: any) => ({
        ...prev,
        parseDOM: [
            {
                tag: 'div.footnote-def',
                getAttrs: (dom: HTMLElement) => ({
                    label: normalizeFootnoteLabel(dom.dataset.id || dom.dataset.label),
                }),
                contentElement: '.footnote-def-content',
            },
            ...(prev.parseDOM || []),
        ],
        parseMarkdown: {
            match: (node: any) => prev.parseMarkdown?.match?.(node) ?? node.type === 'footnoteDefinition',
            runner: (state: any, node: any, type: any) => {
                const label = normalizeFootnoteLabel(node.label || node.identifier);
                if (!label) return;
                state.openNode(type, { label });
                state.next(node.children);
                state.closeNode();
            },
        },
        toMarkdown: {
            match: (node: any) => node.type.name === 'footnote_definition',
            runner: (state: any, node: any) => {
                const label = normalizeFootnoteLabel(node.attrs.label);
                if (!label) return;
                state.openNode('footnoteDefinition', undefined, { label, identifier: label });
                state.next(node.content);
                state.closeNode();
            },
        },
        toDOM: (node: any) => {
            const label = normalizeFootnoteLabel(node.attrs.label);

            return [
                'div',
                {
                    class: 'footnote-def footnote-line',
                    'data-id': label,
                    'data-label': label,
                    'data-type': 'footnote_definition',
                    id: `fn-${label}`,
                },
                ['span', { class: 'footnote-def-label', contenteditable: 'false' }, `[${label}]:`],
                ['div', { class: 'footnote-def-content' }, 0],
            ];
        },
    }));
}

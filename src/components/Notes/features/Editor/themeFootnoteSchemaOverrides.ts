import type { Ctx } from '@milkdown/kit/ctx';
import {
    footnoteDefinitionSchema,
    footnoteReferenceSchema,
} from '@milkdown/kit/preset/gfm';
import { updateSchemaFactory } from './themeSchemaUtils';

export function applyFootnoteSchemaOverrides(ctx: Ctx) {
    updateSchemaFactory(ctx, footnoteReferenceSchema.key, (prev: any) => ({
        ...prev,
        parseDOM: [
            {
                tag: 'sup.footnote-ref',
                getAttrs: (dom: HTMLElement) => ({
                    label: dom.dataset.id || dom.dataset.label || '',
                }),
            },
            ...(prev.parseDOM || []),
        ],
        toDOM: (node: any) => {
            const label = String(node.attrs.label ?? '');
            const displayLabel = `[${label}]`;

            return [
                'sup',
                {
                    class: 'footnote-ref',
                    'data-id': label,
                    'data-label': label,
                    'data-type': 'footnote_reference',
                    'data-footnote-value': displayLabel,
                    'aria-label': `Footnote ${label}`,
                },
                ['span', { class: 'footnote-ref-label' }, displayLabel],
            ];
        },
    }));

    updateSchemaFactory(ctx, footnoteDefinitionSchema.key, (prev: any) => ({
        ...prev,
        parseDOM: [
            {
                tag: 'div.footnote-def',
                getAttrs: (dom: HTMLElement) => ({
                    label: dom.dataset.id || dom.dataset.label || '',
                }),
                contentElement: '.footnote-def-content',
            },
            ...(prev.parseDOM || []),
        ],
        toDOM: (node: any) => {
            const label = String(node.attrs.label ?? '');

            return [
                'div',
                {
                    class: 'footnote-def',
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

import { describe, expect, it } from 'vitest';
import { serializeSliceToText } from './serializer';

function createTextNode(text: string, marks: any[] = []) {
    return {
        isText: true,
        text,
        marks,
    };
}

function createBlockNode(typeName: string, children: any[] = [], attrs: Record<string, unknown> = {}) {
    return {
        isText: false,
        isBlock: true,
        attrs,
        type: { name: typeName },
        content: {
            size: children.length,
            forEach(callback: (child: any) => void) {
                children.forEach(callback);
            },
        },
    };
}

function createInlineNode(typeName: string, children: any[] = []) {
    return {
        isText: false,
        isBlock: false,
        type: { name: typeName },
        content: {
            size: children.length,
            forEach(callback: (child: any) => void) {
                children.forEach(callback);
            },
        },
    };
}

function createSlice(nodes: any[]) {
    return {
        content: {
            forEach(callback: (node: any) => void) {
                nodes.forEach(callback);
            },
        },
    };
}

describe('serializeSliceToText', () => {
    it('serializes thematic breaks as markdown separators', () => {
        const slice = createSlice([
            createBlockNode('paragraph', [createTextNode('alpha')]),
            createBlockNode('hr'),
            createBlockNode('paragraph', [createTextNode('beta')]),
        ]);

        expect(serializeSliceToText(slice)).toBe('alpha\n---\nbeta');
    });

    it('serializes headings with atx syntax', () => {
        const slice = createSlice([
            createBlockNode('heading', [createTextNode('Title')], { level: 2 }),
        ]);

        expect(serializeSliceToText(slice)).toBe('## Title');
    });

    it('serializes code blocks with fences and language', () => {
        const slice = createSlice([
            createBlockNode('code_block', [createTextNode('const a = 1;\nconsole.log(a);')], { language: 'ts' }),
        ]);

        expect(serializeSliceToText(slice)).toBe('```ts\nconst a = 1;\nconsole.log(a);\n```');
    });

    it('preserves internal blank lines inside copied code blocks', () => {
        const slice = createSlice([
            createBlockNode('code_block', [createTextNode('const a = 1;\n\nconsole.log(a);')], { language: 'ts' }),
        ]);

        expect(serializeSliceToText(slice)).toBe('```ts\nconst a = 1;\n\nconsole.log(a);\n```');
    });

    it('preserves trailing blank lines inside copied code blocks', () => {
        const slice = createSlice([
            createBlockNode('code_block', [createTextNode('const a = 1;\n\n')], { language: 'ts' }),
        ]);

        expect(serializeSliceToText(slice)).toBe('```ts\nconst a = 1;\n\n\n```');
    });

    it('keeps markdown link syntax for linked text', () => {
        const slice = createSlice([
            createInlineNode('paragraph', [
                createTextNode('OpenAI', [{ type: { name: 'link' }, attrs: { href: 'https://openai.com' } }]),
            ]),
        ]);

        expect(serializeSliceToText(slice)).toBe('[OpenAI](https://openai.com)');
    });

    it('escapes linked text and parenthesized urls as standard markdown', () => {
        const slice = createSlice([
            createInlineNode('paragraph', [
                createTextNode('Docs [draft]', [{ type: { name: 'link' }, attrs: { href: 'https://example.com/a_(b)' } }]),
            ]),
        ]);

        expect(serializeSliceToText(slice)).toBe('[Docs \\[draft\\]](https://example.com/a_\\(b\\))');
    });

    it('uses angle destinations for linked urls with spaces', () => {
        const slice = createSlice([
            createInlineNode('paragraph', [
                createTextNode('Local file', [{ type: { name: 'link' }, attrs: { href: 'docs/file name.md' } }]),
            ]),
        ]);

        expect(serializeSliceToText(slice)).toBe('[Local file](<docs/file name.md>)');
    });
});

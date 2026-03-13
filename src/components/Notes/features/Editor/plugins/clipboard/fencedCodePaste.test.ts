import { describe, expect, it } from 'vitest';
import {
    extractLargestMarkdownFenceContent,
    isStandaloneFencedCodeBlock,
    looksLikeMarkdownForPaste,
    normalizeStandaloneThematicBreaksForPaste,
    parseStandaloneAtxHeading,
    parseStandaloneFencedCodeBlock,
} from './fencedCodePaste';

describe('isStandaloneFencedCodeBlock', () => {
    it('matches a basic fenced code block', () => {
        expect(isStandaloneFencedCodeBlock('```\n# ni\n```')).toBe(true);
    });

    it('matches fenced code block with language and windows line endings', () => {
        expect(isStandaloneFencedCodeBlock('```ts\r\nconst a = 1;\r\n```')).toBe(true);
    });

    it('extracts code content and language', () => {
        expect(parseStandaloneFencedCodeBlock('```md\n# ni \n```')).toEqual({
            language: 'md',
            code: '# ni ',
        });
    });

    it('does not match when fenced block is mixed with non-fence text', () => {
        expect(isStandaloneFencedCodeBlock('before\n```ts\nconst a = 1;\n```\nafter')).toBe(false);
    });

    it('does not match inline code fence text', () => {
        expect(isStandaloneFencedCodeBlock('```ts```')).toBe(false);
    });

    it('returns null for invalid fenced text', () => {
        expect(parseStandaloneFencedCodeBlock('before\n```ts\nconst a = 1;\n```')).toBeNull();
    });
});

describe('parseStandaloneAtxHeading', () => {
    it('parses basic heading', () => {
        expect(parseStandaloneAtxHeading('# ni ')).toEqual({ level: 1, text: 'ni' });
    });

    it('parses trailing spaces and keeps text trimmed', () => {
        expect(parseStandaloneAtxHeading('# nii   ')).toEqual({ level: 1, text: 'nii' });
    });

    it('parses single character heading', () => {
        expect(parseStandaloneAtxHeading('# i')).toEqual({ level: 1, text: 'i' });
    });

    it('parses heading with level and trailing newline', () => {
        expect(parseStandaloneAtxHeading('### hello world\n')).toEqual({ level: 3, text: 'hello world' });
    });

    it('does not parse multiline input', () => {
        expect(parseStandaloneAtxHeading('# a\nb')).toBeNull();
    });
});

describe('looksLikeMarkdownForPaste', () => {
    it('detects blockquote markdown', () => {
        expect(looksLikeMarkdownForPaste('> quote')).toBe(true);
    });

    it('detects ordered list markdown', () => {
        expect(looksLikeMarkdownForPaste('1. item')).toBe(true);
    });

    it('detects list markdown', () => {
        expect(looksLikeMarkdownForPaste('- item')).toBe(true);
    });

    it('detects markdown link syntax', () => {
        expect(looksLikeMarkdownForPaste('[OpenAI](https://openai.com)')).toBe(true);
    });

    it('detects table-like markdown row', () => {
        expect(looksLikeMarkdownForPaste('| a | b |')).toBe(true);
    });

    it('detects inline markdown', () => {
        expect(looksLikeMarkdownForPaste('**bold** text')).toBe(true);
    });

    it('ignores plain text', () => {
        expect(looksLikeMarkdownForPaste('hello world')).toBe(false);
    });
});

describe('extractLargestMarkdownFenceContent', () => {
    it('extracts content from a standalone markdown fence', () => {
        expect(extractLargestMarkdownFenceContent('```markdown\n# Title\n- item\n```')).toBe('# Title\n- item');
    });

    it('extracts the largest markdown fence from mixed prose', () => {
        const value = [
            'intro',
            '```markdown',
            '# Main',
            '```python',
            'print(1)',
            '```',
            '```',
            'tail',
        ].join('\n');

        expect(extractLargestMarkdownFenceContent(value)).toBe('# Main\n```python\nprint(1)\n```');
    });

    it('returns null when markdown fence is missing', () => {
        expect(extractLargestMarkdownFenceContent('```ts\nconst a = 1;\n```')).toBeNull();
    });
});

describe('normalizeStandaloneThematicBreaksForPaste', () => {
    it('adds blank lines around thematic breaks next to plain content', () => {
        expect(normalizeStandaloneThematicBreaksForPaste('---\n测试\n---')).toBe('---\n\n测试\n\n---');
    });

    it('disambiguates a trailing thematic break from a setext heading underline', () => {
        expect(normalizeStandaloneThematicBreaksForPaste('Title\n---')).toBe('Title\n\n---');
    });

    it('keeps existing blank-line-separated thematic breaks unchanged', () => {
        expect(normalizeStandaloneThematicBreaksForPaste('---\n\nBody\n\n---')).toBe('---\n\nBody\n\n---');
    });

    it('does not rewrite thematic-break-like lines inside fenced code', () => {
        const value = ['```md', 'alpha', '---', 'beta', '```', '---', 'tail'].join('\n');
        expect(normalizeStandaloneThematicBreaksForPaste(value)).toBe(['```md', 'alpha', '---', 'beta', '```', '---', '', 'tail'].join('\n'));
    });
});

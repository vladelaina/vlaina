import { describe, expect, it } from 'vitest';
import { normalizeHtmlBlockEditorValueForMarkdown } from './htmlBlockEditorPlugin';

describe('normalizeHtmlBlockEditorValueForMarkdown', () => {
  it('keeps markdown HTML block values unchanged', () => {
    expect(normalizeHtmlBlockEditorValueForMarkdown('<p>hello</p>')).toBe('<p>hello</p>');
    expect(normalizeHtmlBlockEditorValueForMarkdown('<img src="x.png">')).toBe('<img src="x.png">');
  });

  it('wraps plain text so it remains an HTML block in markdown', () => {
    expect(normalizeHtmlBlockEditorValueForMarkdown('h1')).toBe('<div>h1</div>');
  });

  it('escapes plain text before wrapping it as HTML', () => {
    expect(normalizeHtmlBlockEditorValueForMarkdown('1 < 2')).toBe('<div>1 &lt; 2</div>');
  });
});

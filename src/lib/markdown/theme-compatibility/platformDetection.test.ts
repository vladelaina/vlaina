import { describe, expect, it } from 'vitest';
import { detectMarkdownThemePlatform, isStandaloneMarkdownThemeCss } from './platformDetection';

describe('markdown theme platform detection', () => {
  it('detects Typora themes from document selectors and variables', () => {
    expect(detectMarkdownThemePlatform([
      ':root { --bg-color: #fff; --text-color: #222; }',
      '#write h1 { color: var(--text-color); }',
      '.md-fences { border-radius: 4px; }',
    ].join('\n'))).toBe('typora');
  });

  it('detects Obsidian themes from preview selectors and variables', () => {
    expect(detectMarkdownThemePlatform([
      'body.theme-dark { --background-primary: #111; --text-normal: #ddd; }',
      '.markdown-preview-view h1 { color: var(--interactive-accent); }',
      '.markdown-source-view.mod-cm6 .cm-line { caret-color: var(--text-normal); }',
    ].join('\n'))).toBe('obsidian');
  });

  it('uses Typora as the conservative fallback for ambiguous CSS', () => {
    expect(detectMarkdownThemePlatform('h1 { color: red; }')).toBe('typora');
  });

  it('treats generic markdown styling CSS as a standalone theme', () => {
    expect(isStandaloneMarkdownThemeCss('h1 { color: red; }')).toBe(true);
  });

  it('does not treat pure font helper CSS as a standalone theme', () => {
    expect(isStandaloneMarkdownThemeCss([
      '@font-face { font-family: "VLOOK"; src: url("./vlook.woff2") format("woff2"); }',
      '@font-face { font-family: "VLOOK Mono"; src: url("./mono.woff2") format("woff2"); }',
    ].join('\n'))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { codeBlockLanguages } from './codeBlockLanguageLoader';
import {
  normalizeCodeBlockLanguage,
  parseCodeFenceLanguage,
  parseCodeLanguageFromClassName,
} from './codeBlockLanguage';

describe('codeBlockLanguage', () => {
  it('parses class-based languages with extended characters', () => {
    expect(parseCodeLanguageFromClassName('token language-objective-c')).toBe('objective-c');
    expect(parseCodeLanguageFromClassName('plain-code')).toBeNull();
  });

  it('parses fenced code languages with plus and dash markers', () => {
    expect(parseCodeFenceLanguage('```c++')).toBe('c++');
    expect(parseCodeFenceLanguage('```shell-session')).toBe('shell-session');
    expect(parseCodeFenceLanguage('``` shell-session title="Example"')).toBe('shell-session');
    expect(parseCodeFenceLanguage('~~~shell-session')).toBe('shell-session');
    expect(parseCodeFenceLanguage('~~~ shell-session title="A ~ B"')).toBe('shell-session');
    expect(parseCodeFenceLanguage('   ```shell-session')).toBe('shell-session');
    expect(parseCodeFenceLanguage('```')).toBe('');
    expect(parseCodeFenceLanguage('``')).toBeNull();
    expect(parseCodeFenceLanguage('``` shell-session `bad`')).toBeNull();
    expect(parseCodeFenceLanguage('    ```shell-session')).toBeNull();
  });

  it('normalizes catalog aliases before falling back to lowercase ids', () => {
    expect(normalizeCodeBlockLanguage('TS')).toBe('ts');
    expect(normalizeCodeBlockLanguage('text')).toBe('txt');
    expect(normalizeCodeBlockLanguage('plaintext')).toBe('txt');
    expect(normalizeCodeBlockLanguage('vim')).toBe('viml');
    expect(normalizeCodeBlockLanguage('Custom-Lang')).toBe('custom-lang');
    expect(normalizeCodeBlockLanguage('')).toBeNull();
  });

  it('keeps fallback language ids bounded and class-safe', () => {
    expect(normalizeCodeBlockLanguage('foo.bar_baz#1+2')).toBe('foo.bar_baz#1+2');
    expect(normalizeCodeBlockLanguage('two words')).toBeNull();
    expect(normalizeCodeBlockLanguage('javascript" onclick="alert(1)')).toBeNull();
    expect(normalizeCodeBlockLanguage('x'.repeat(65))).toBeNull();
  });

  it('exposes catalog-only languages in the selector list', () => {
    expect(codeBlockLanguages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'txt', name: 'TXT' }),
        expect.objectContaining({ id: 'viml', name: 'Vim Script' }),
      ]),
    );
  });
});

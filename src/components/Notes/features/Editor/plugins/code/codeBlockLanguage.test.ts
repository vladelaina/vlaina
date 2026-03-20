import { describe, expect, it } from 'vitest';
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
    expect(parseCodeFenceLanguage('```')).toBe('');
    expect(parseCodeFenceLanguage('``')).toBeNull();
  });

  it('normalizes known languages and preserves unknown ids consistently', () => {
    expect(normalizeCodeBlockLanguage('TS')).toBe('ts');
    expect(normalizeCodeBlockLanguage('Custom-Lang')).toBe('custom-lang');
    expect(normalizeCodeBlockLanguage('')).toBeNull();
  });
});

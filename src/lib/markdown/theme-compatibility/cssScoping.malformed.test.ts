import { describe, expect, it } from 'vitest';
import { buildImportedAppThemeCss } from './appThemeBridge';
import { scopeImportedMarkdownThemeCss } from './cssScoping';

describe('imported theme malformed CSS handling', () => {
  it('drops malformed markdown CSS instead of returning unscoped CSS', () => {
    expect(scopeImportedMarkdownThemeCss('#write { color: red', 'typora')).toBe('');
  });

  it('ignores malformed CSS while collecting app theme variables', () => {
    expect(buildImportedAppThemeCss('body.theme-dark { --background-primary: #111', 'broken', 'obsidian')).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import { EDITOR_ICONS } from './editor-svgs';

describe('EDITOR_ICONS', () => {
  it('marks inline toolbar SVGs as decorative and non-focusable', () => {
    for (const [name, markup] of Object.entries(EDITOR_ICONS)) {
      const template = document.createElement('template');
      template.innerHTML = markup;
      const svg = template.content.querySelector('svg');

      expect(svg, name).not.toBeNull();
      expect(svg?.getAttribute('aria-hidden'), name).toBe('true');
      expect(svg?.getAttribute('focusable'), name).toBe('false');
    }
  });
});

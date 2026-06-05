import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n', () => ({
  translate: () => '<img src=x onerror=alert(1)> error',
}));

import { mermaidRenderErrorMarkup } from './mermaidRenderer';

describe('mermaidRenderer markup', () => {
  it('escapes translated render errors before returning html markup', () => {
    const template = document.createElement('template');
    template.innerHTML = mermaidRenderErrorMarkup();

    expect(template.content.querySelector('img')).toBeNull();
    expect(template.content.querySelector('.mermaid-error')?.textContent).toBe(
      '<img src=x onerror=alert(1)> error'
    );
  });
});

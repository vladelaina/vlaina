import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReadOnlyCodeBlock } from './ReadOnlyCodeBlock';

describe('ReadOnlyCodeBlock security', () => {
  it('escapes executable HTML emitted from highlighted code input', () => {
    const maliciousCode = '<img src=x onerror=alert(1)><script>alert(2)</script>';

    const { container } = render(
      <ReadOnlyCodeBlock className="language-html">
        {maliciousCode}
      </ReadOnlyCodeBlock>
    );

    const code = container.querySelector('code');
    expect(code).toBeInstanceOf(HTMLElement);
    expect(code?.textContent).toContain(maliciousCode);
    expect(code?.querySelector('img')).toBeNull();
    expect(code?.querySelector('script')).toBeNull();
    expect(code?.innerHTML).not.toContain('onerror=');
  });
});

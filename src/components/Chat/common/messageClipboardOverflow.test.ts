import { describe, expect, it } from 'vitest';
import { formatMessageCopyText } from './messageClipboard';

describe('messageClipboard overflow image scrubbing', () => {
  it('does not leak data image sources hidden behind oversized HTML attributes', () => {
    const content = `<img alt="${'a'.repeat(21_000)}" src="data:image/png;base64,SECRET"> after`;

    const copied = formatMessageCopyText(content);

    expect(copied).not.toContain('data:image/png;base64,SECRET');
    expect(copied).not.toContain('<img');
    expect(copied).toContain('[image] after');
  });
});

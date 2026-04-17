import { describe, expect, it } from 'vitest';
import { resolveUserMessageBubbleWidth } from './chatUserBubbleWidth';

describe('chatUserBubbleWidth', () => {
  it('returns null when there is no text or container width', () => {
    expect(resolveUserMessageBubbleWidth('', 800)).toBeNull();
    expect(resolveUserMessageBubbleWidth('hello', 0)).toBeNull();
  });

  it('keeps short single-line messages compact', () => {
    const width = resolveUserMessageBubbleWidth('ok', 900);
    expect(width).not.toBeNull();
    expect(width!).toBeLessThan(120);
  });

  it('shrinks long wrapped messages below the maximum bubble width', () => {
    const text = 'This is a longer user message that should wrap across multiple lines while still keeping a tighter bubble width than the plain ninety percent cap.';
    const width = resolveUserMessageBubbleWidth(text, 900);
    const contentWidth = Math.max(240, Math.min(850, 900 - 32));
    const maxBubbleWidth = Math.floor(contentWidth * 0.9);

    expect(width).not.toBeNull();
    expect(width!).toBeGreaterThan(140);
    expect(width!).toBeLessThan(maxBubbleWidth);
  });

  it('reuses the same tight width across nearby container widths in the same bucket', () => {
    const text = 'Bucketed width reuse should keep this bubble measurement stable across tiny resize deltas.';
    const first = resolveUserMessageBubbleWidth(text, 721);
    const second = resolveUserMessageBubbleWidth(text, 727);

    expect(first).toBe(second);
  });
});

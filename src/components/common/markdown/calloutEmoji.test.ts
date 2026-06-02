import { describe, expect, it } from 'vitest';
import { consumeLeadingCalloutEmoji } from './calloutEmoji';

describe('consumeLeadingCalloutEmoji', () => {
  it('accepts leading emoji callout icons', () => {
    expect(consumeLeadingCalloutEmoji('💡 Tip')).toEqual({ icon: '💡', rest: 'Tip' });
    expect(consumeLeadingCalloutEmoji('🇺🇸 Flag')).toEqual({ icon: '🇺🇸', rest: 'Flag' });
    expect(consumeLeadingCalloutEmoji('1️⃣ Keycap')).toEqual({ icon: '1️⃣', rest: 'Keycap' });
  });

  it('rejects ordinary text and text-presentation symbols', () => {
    expect(consumeLeadingCalloutEmoji('1. Keep this quoted')).toBeNull();
    expect(consumeLeadingCalloutEmoji('Note: keep this quoted')).toBeNull();
    expect(consumeLeadingCalloutEmoji('© Copyright')).toBeNull();
    expect(consumeLeadingCalloutEmoji('™ Trademark')).toBeNull();
  });
});

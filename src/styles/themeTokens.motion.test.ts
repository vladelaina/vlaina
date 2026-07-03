import { describe, expect, it } from 'vitest';
import { themeBackdropTokens, themeMotionTokens } from './themeTokens';

describe('theme motion tokens', () => {
  it('keeps modal entrance durations snappy', () => {
    expect(themeBackdropTokens.settingsModalDurationSeconds).toBeLessThanOrEqual(0.1);
    expect(themeMotionTokens.settingsModalDuration).toBeLessThanOrEqual(0.1);
    expect(themeBackdropTokens.createNotesRootDurationSeconds).toBeLessThanOrEqual(0.1);
    expect(themeMotionTokens.notesRootModalDuration).toBeLessThanOrEqual(0.1);
  });

  it('keeps embedded sidebar overlay fades snappy', () => {
    expect(themeMotionTokens.chatEmbeddedOverlayDuration).toBeLessThanOrEqual(0.1);
  });
});

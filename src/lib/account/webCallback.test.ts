import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleWebAccountAuthCallback } from './webCallback';

describe('web account callback parsing', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('parses successful oauth callbacks and clears the query string', () => {
    window.history.replaceState({}, '', '/callback?provider=google&state=abc&code=123');
    const replaceSpy = vi.spyOn(window.history, 'replaceState');

    expect(handleWebAccountAuthCallback()).toEqual({
      provider: 'google',
      state: 'abc',
      error: null,
      code: '123',
    });
    expect(replaceSpy).toHaveBeenCalledWith({}, '', '/callback');
  });

  it('parses explicit auth_state callbacks', () => {
    window.history.replaceState({}, '', '/callback?auth_provider=google&auth_state=xyz');

    expect(handleWebAccountAuthCallback()).toEqual({
      provider: 'google',
      state: 'xyz',
      error: null,
      code: null,
    });
  });

  it('parses callback errors', () => {
    window.history.replaceState({}, '', '/callback?provider=google&auth_error=denied&state=oops');

    expect(handleWebAccountAuthCallback()).toEqual({
      provider: 'google',
      state: 'oops',
      error: 'denied',
      code: null,
    });
  });

  it('returns null when no auth callback fields are present', () => {
    window.history.replaceState({}, '', '/callback?foo=bar');

    expect(handleWebAccountAuthCallback()).toBeNull();
  });

  it('ignores unsupported oauth providers', () => {
    window.history.replaceState({}, '', '/callback?provider=github&state=abc&code=123');

    expect(handleWebAccountAuthCallback()).toBeNull();
  });
});

import { describe, expect, it, afterEach } from 'vitest';

import {
  MAX_SESSION_ID_ALIASES,
  aliasSessionId,
  clearSessionIdAliases,
  resolveSessionIdAlias,
} from './sessionIdAliases';

describe('sessionIdAliases', () => {
  afterEach(() => {
    clearSessionIdAliases();
  });

  it('ignores unsafe session ids', () => {
    aliasSessionId('../temp-session', 'session-1');
    aliasSessionId('temp-session-1', '../session');

    expect(resolveSessionIdAlias('../temp-session')).toBe('../temp-session');
    expect(resolveSessionIdAlias('temp-session-1')).toBe('temp-session-1');
  });

  it('bounds stored aliases and evicts the oldest aliases first', () => {
    for (let index = 0; index <= MAX_SESSION_ID_ALIASES; index += 1) {
      aliasSessionId(`temp-session-${index}`, `session-${index}`);
    }

    expect(resolveSessionIdAlias('temp-session-0')).toBe('temp-session-0');
    expect(resolveSessionIdAlias('temp-session-1')).toBe('session-1');
    expect(resolveSessionIdAlias(`temp-session-${MAX_SESSION_ID_ALIASES}`)).toBe(`session-${MAX_SESSION_ID_ALIASES}`);
  });
});

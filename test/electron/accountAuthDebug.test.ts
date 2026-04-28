import { describe, expect, it } from 'vitest';
import { summarizeAuthPayload } from '../../electron/accountAuthDebug.mjs';

describe('desktop auth debug redaction', () => {
  it('recursively redacts token, secret, and verifier fields', () => {
    expect(
      summarizeAuthPayload({
        username: 'alice',
        credentials: {
          appSessionToken: 'nts_0123456789abcdef',
          nested: {
            clientSecret: 'secret_0123456789',
          },
        },
        authStart: {
          resultToken: 'rat_0123456789abcdef',
          verifier: ['verifier_0123456789abcdef'],
        },
        state: 'oauth-state',
      }),
    ).toEqual({
      username: 'alice',
      credentials: {
        appSessionToken: 'nts_01…cdef',
        nested: {
          clientSecret: 'secret…6789',
        },
      },
      authStart: {
        resultToken: 'rat_01…cdef',
        verifier: ['verifi…cdef'],
      },
      state: 'oauth-state',
    });
  });
});

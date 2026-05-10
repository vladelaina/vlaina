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
          authUrl: 'https://accounts.example/auth?state=oauth-state&code_challenge=secret#frag',
        },
        email: {
          code: '123456',
          verificationCode: '987654',
          statusCode: 200,
        },
        state: 'oauth-state-0123456789',
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
          authUrl: 'https://accounts.example/auth',
        },
        email: {
          code: '12…56',
          verificationCode: '98…54',
          statusCode: 200,
        },
        state: 'oauth-…6789',
      });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createDesktopAccountJsonClient } from '../../electron/accountJsonClient.mjs';

describe('desktop account json client', () => {
  it('logs only payload summaries for debug fetch responses', async () => {
    const logDesktopAuth = vi.fn();
    const client = createDesktopAccountJsonClient({ logDesktopAuth });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({
        appSessionToken: 'nts_response_secret',
        username: 'alice',
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-app-session-token': 'nts_header_secret',
        },
      })),
    );

    const result = await client.fetchJsonWithDebug('https://api.example.com/auth/session', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alice@example.com',
        code: '123456',
      }),
    }, 'session_status:http');

    expect(result.payload?.username).toBe('alice');
    const requestLog = logDesktopAuth.mock.calls.find(([event]) => event === 'session_status:http:request')?.[1];
    expect(requestLog).toMatchObject({
      bodySummary: {
        type: 'json',
        value: {
          email: 'alice@example.com',
          code: '12…56',
        },
        length: expect.any(Number),
      },
    });
    expect(JSON.stringify(requestLog)).not.toContain('123456');
    const responseLog = logDesktopAuth.mock.calls.find(([event]) => event === 'session_status:http:response')?.[1];
    expect(responseLog).toMatchObject({
      textLength: expect.any(Number),
      payloadSummary: {
        type: 'object',
        keys: ['appSessionToken', 'username'],
      },
    });
    expect(JSON.stringify(responseLog)).not.toContain('nts_response_secret');
    expect(JSON.stringify(responseLog)).not.toContain('nts_header_secret');
  });

  it('does not log raw account data on successful json requests', async () => {
    const logDesktopAuth = vi.fn();
    const client = createDesktopAccountJsonClient({ logDesktopAuth });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({
        appSessionToken: 'nts_body_secret',
        username: 'alice',
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-app-session-token': 'nts_header_secret',
        },
      })),
    );

    const result = await client.fetchDesktopJson('https://api.example.com/desktop/result', {
      method: 'POST',
      body: JSON.stringify({
        verifier: 'verifier_secret',
        resultToken: 'rat_secret',
      }),
    });

    expect(result.data.appSessionToken).toBe('nts_body_secret');
    const startLog = logDesktopAuth.mock.calls.find(([event]) => event === 'fetch_json:start')?.[1];
    expect(JSON.stringify(startLog)).not.toContain('verifier_secret');
    expect(JSON.stringify(startLog)).not.toContain('rat_secret');
    const doneLog = logDesktopAuth.mock.calls.find(([event]) => event === 'fetch_json:done')?.[1];
    expect(doneLog).toMatchObject({
      headerAppSessionToken: 'nts_he…cret',
      dataSummary: {
        type: 'object',
        keys: ['appSessionToken', 'username'],
      },
      summary: {
        username: 'alice',
        hasAppSessionToken: true,
      },
    });
    expect(JSON.stringify(doneLog)).not.toContain('nts_body_secret');
    expect(JSON.stringify(doneLog)).not.toContain('nts_header_secret');
  });
});

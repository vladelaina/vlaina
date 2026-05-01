import { createServer } from 'node:http';

const loopbackCallbackPath = '/oauth/callback';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function bindDesktopAuthLoopbackServer({ logDesktopAuth, timeoutSeconds }) {
  let settled = false;
  let timer = null;
  let resolveCallback;
  let rejectCallback;

  const callbackPromise = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });

  const server = createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method !== 'GET') {
        response.writeHead(405, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<h1>Authorization Failed</h1><p>Unsupported callback method.</p>');
        return;
      }

      if (requestUrl.pathname !== loopbackCallbackPath) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<h1>Authorization Failed</h1><p>Unexpected OAuth callback path.</p>');
        return;
      }

      const state = requestUrl.searchParams.get('state')?.trim() ?? '';
      const resultToken = requestUrl.searchParams.get('result_token')?.trim() ?? '';
      const error = requestUrl.searchParams.get('error')?.trim() ?? null;

      logDesktopAuth('loopback_callback:received', {
        pathname: requestUrl.pathname,
        state,
        resultToken,
        error,
      });

      if (!state || !resultToken) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<h1>Authorization Failed</h1><p>OAuth callback is missing state or result token.</p>');
        return;
      }

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(
        error
          ? `<h1>Authorization Failed</h1><p>${escapeHtml(error)}</p><p>You can return to vlaina now.</p>`
          : '<h1>Authorization Received</h1><p>Return to vlaina to finish sign-in.</p>'
      );

      if (!settled) {
        settled = true;
        clearTimeout(timer);
        server.close();
        resolveCallback({ state, resultToken, error });
      }
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<h1>Authorization Failed</h1><p>Invalid callback request.</p>');
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        server.close();
        rejectCallback(error);
      }
    }
  });

  const serverReady = await new Promise((resolve, reject) => {
    server.on('error', (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to bind local OAuth callback server: ${error.message}`));
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        settled = true;
        server.close();
        reject(new Error('Failed to read local OAuth callback address'));
        return;
      }

      timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          server.close();
          rejectCallback(new Error('Authorization timed out'));
        }
      }, Math.max(30, timeoutSeconds) * 1000);

      resolve({
        callbackUrl: `http://127.0.0.1:${address.port}${loopbackCallbackPath}`,
      });
    });
  });

  return {
    ...serverReady,
    close: () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      server.close();
    },
    cancel: (reason = 'Authorization cancelled') => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      server.close();
      rejectCallback(new Error(reason));
    },
    waitForCallback: () => callbackPromise,
  };
}

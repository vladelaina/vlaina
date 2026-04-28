import { app, BrowserWindow } from 'electron';

export function isDesktopAuthDebugEnabled() {
  return !app.isPackaged || process.env.VLAINA_DESKTOP_AUTH_DEBUG === '1';
}

export function redactToken(value) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.length <= 10) {
    return `${trimmed.slice(0, 2)}…${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

export function summarizeAuthPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload ?? null;
  }

  return {
    ...payload,
    sessionToken: redactToken(payload.sessionToken),
    appSessionToken: redactToken(payload.appSessionToken),
    token: redactToken(payload.token),
    resultToken: redactToken(payload.resultToken),
    verifier: redactToken(payload.verifier),
    state: typeof payload.state === 'string' ? payload.state : payload.state ?? null,
  };
}

export function summarizeAuthResultShape(result) {
  if (!result || typeof result !== 'object') {
    return result ?? null;
  }

  return {
    success: result.success ?? null,
    pending: result.pending ?? null,
    provider: typeof result.provider === 'string' ? result.provider : null,
    username: typeof result.username === 'string' ? result.username : null,
    primaryEmail: typeof result.primaryEmail === 'string' ? result.primaryEmail : null,
    hasSessionToken: typeof result.sessionToken === 'string' && result.sessionToken.trim().length > 0,
    hasAppSessionToken: typeof result.appSessionToken === 'string' && result.appSessionToken.trim().length > 0,
    hasToken: typeof result.token === 'string' && result.token.trim().length > 0,
    error: typeof result.error === 'string' ? result.error : null,
  };
}

export function createDesktopAuthLogger() {
  const desktopAuthDebugBuffer = [];

  function logDesktopAuth(event, details = {}) {
    if (!isDesktopAuthDebugEnabled()) {
      return;
    }

    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      event,
      details: summarizeAuthPayload(details),
    };
    desktopAuthDebugBuffer.push(entry);
    if (desktopAuthDebugBuffer.length > 200) {
      desktopAuthDebugBuffer.splice(0, desktopAuthDebugBuffer.length - 200);
    }
    console.info(`[desktop auth][${timestamp}] ${event}`, entry.details);
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) {
        continue;
      }
      window.webContents.send('desktop:account:auth-log', entry);
    }
  }

  return {
    getAuthDebugLog: () => desktopAuthDebugBuffer.slice(-80),
    logDesktopAuth,
  };
}

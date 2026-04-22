export const desktopLegacySessionHeader = 'x-app-session-token';

function readTrimmedString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function resolveDesktopSessionToken(result) {
  return (
    readTrimmedString(result?.sessionToken) ||
    readTrimmedString(result?.appSessionToken) ||
    readTrimmedString(result?.token) ||
    ''
  );
}

export function buildDesktopSessionHeaders(sessionToken, initHeaders = {}) {
  const normalizedToken = readTrimmedString(sessionToken);
  if (!normalizedToken) {
    return { ...initHeaders };
  }

  return {
    ...initHeaders,
    [desktopLegacySessionHeader]: normalizedToken,
    Authorization: `Bearer ${normalizedToken}`,
  };
}

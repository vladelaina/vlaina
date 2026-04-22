export const desktopLegacySessionHeader = 'x-app-session-token';
const desktopBearerTokenPrefix = 'nts_';

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

  if (normalizedToken.startsWith(desktopBearerTokenPrefix)) {
    return {
      ...initHeaders,
      Authorization: `Bearer ${normalizedToken}`,
    };
  }

  return {
    ...initHeaders,
    [desktopLegacySessionHeader]: normalizedToken,
    Authorization: `Bearer ${normalizedToken}`,
  };
}

export function getExternalWatchErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; toString?: () => string };
    if (typeof candidate.message === 'string') {
      return candidate.message;
    }
    if (typeof candidate.toString === 'function') {
      const value = candidate.toString();
      if (value && value !== '[object Object]') {
        return value;
      }
    }
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isExternalWatchUnavailableError(error: unknown) {
  const message = getExternalWatchErrorMessage(error).toLowerCase();
  return (
    message.includes('electron fs bridge is not available') ||
    message.includes('fs.watch not allowed') ||
    message.includes('watch not allowed') ||
    message.includes('enospc') ||
    message.includes('system limit for number of file watchers reached') ||
    message.includes('command watch not found') ||
    message.includes('command not found: watch') ||
    message.includes('enospc') ||
    message.includes('system limit for number of file watchers reached')
  );
}

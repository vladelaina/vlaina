const MAX_ERROR_MESSAGE_LENGTH = 500;

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/\b(?:[a-z]:[\\/]|\\\\)[^\s"'`]+/gi, '<path>')
    .replace(/(^|[\s("'`])\/(?:[^/\s"'`]+\/)*[^\s"'`]*/g, '$1<path>')
    .replace(/\b(?:sk|token|key)-[a-z0-9_-]{8,}\b/gi, '<secret>')
    .slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

export function getErrorDiagnosticDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const errorWithMetadata = error as Error & { code?: unknown; conflictReason?: unknown };
    return {
      errorName: error.name,
      errorMessage: sanitizeErrorMessage(error.message),
      ...(typeof errorWithMetadata.code === 'string' || typeof errorWithMetadata.code === 'number'
        ? { errorCode: errorWithMetadata.code }
        : {}),
      ...(typeof errorWithMetadata.conflictReason === 'string'
        ? { conflictReason: errorWithMetadata.conflictReason }
        : {}),
    };
  }

  if (typeof error === 'string') {
    return {
      errorType: 'string',
      errorMessage: sanitizeErrorMessage(error),
    };
  }

  return { errorType: typeof error };
}

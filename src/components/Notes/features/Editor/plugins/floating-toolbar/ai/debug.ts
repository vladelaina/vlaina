const VERBOSE_STORAGE_KEY = 'debug:floating-toolbar-ai';

const IMPORTANT_MESSAGES = new Set([
  'model-selector:mount-skipped',
  'resolve-model:missing-ai-state',
  'resolve-model:model-not-found',
  'resolve-model:provider-not-found',
  'execute:abort-empty-instruction',
  'execute:abort-empty-selection',
  'execute:abort-uneditable-selection',
  'execute:abort-missing-model',
  'execute:abort-empty-model-result',
  'request:error',
]);

function isVerboseEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(VERBOSE_STORAGE_KEY) === '1';
}

export function logAiSelectionDebug(message: string, details?: Record<string, unknown>) {
  if (!isVerboseEnabled() && !IMPORTANT_MESSAGES.has(message)) {
    return;
  }

  const logger = IMPORTANT_MESSAGES.has(message) ? console.warn : console.log;
  if (details) {
    logger(`[FloatingToolbarAI] ${message}`, details);
    return;
  }

  logger(`[FloatingToolbarAI] ${message}`);
}

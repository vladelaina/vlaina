export type ChatDebugLogLevel = 'info' | 'warn' | 'error';

export function addChatDebugLog(
  _scope: string,
  _message: string,
  _data?: Record<string, unknown>,
  _level: ChatDebugLogLevel = 'info',
) {}

function isRelevantElectronAuthEvent(event: string): boolean {
  if (
    event.startsWith('session_status:http') ||
    event.startsWith('session_identity:http') ||
    event.startsWith('stored_session:http')
  ) {
    return true;
  }

  return new Set([
    'ipc:start_auth',
    'oauth:start',
    'oauth:loopback_bound',
    'oauth:start_response',
    'oauth:browser_opened',
    'loopback_callback:received',
    'oauth:callback_resolved',
    'request_auth_result:done',
    'request_auth_result:summary',
    'oauth:completion_resolved',
    'oauth:persist_resolved',
    'oauth:completed',
    'persist_auth_result:missing_token',
    'persist_auth_result:missing_identity',
    'persist_auth_result:session_identity_error',
    'persist_auth_result:session_identity_inline_done',
    'persist_auth_result:done',
    'read_stored_credentials:empty_or_invalid',
    'read_stored_credentials:resolved',
    'write_stored_credentials:done',
    'session_status:start',
    'session_status:unauthorized',
    'session_status:payload',
    'session_status:disconnected_payload',
    'session_status:resolved_connected',
    'session_identity:start',
    'session_identity:unauthorized',
    'session_identity:non_ok',
    'session_identity:payload',
    'session_identity:resolved',
    'clear_stored_credentials:start',
    'clear_stored_credentials:done',
  ]).has(event);
}

export function selectRelevantElectronAuthEntries(entries: Array<{
  timestamp: string;
  event: string;
  details: Record<string, unknown> | null;
}>): Array<{
  timestamp: string;
  event: string;
  details: Record<string, unknown> | null;
}> {
  if (entries.length === 0) {
    return entries;
  }

  const lastStartAuthIndex = entries.findLastIndex((entry) => entry.event === 'ipc:start_auth');
  if (lastStartAuthIndex >= 0) {
    return entries
      .slice(Math.max(0, lastStartAuthIndex - 2))
      .filter((entry) => isRelevantElectronAuthEvent(entry.event));
  }

  const lastSessionIndex = entries.findLastIndex((entry) => entry.event === 'ipc:get_session_status');
  if (lastSessionIndex >= 0) {
    return entries
      .slice(Math.max(0, lastSessionIndex - 2))
      .filter((entry) => isRelevantElectronAuthEvent(entry.event));
  }

  return entries.slice(-40).filter((entry) => isRelevantElectronAuthEvent(entry.event));
}

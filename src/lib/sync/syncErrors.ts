const ERROR_MAP: [RegExp, string][] = [
  [/Sync timeout/i, 'Sync timed out (60s)'],
  [/not authenticated|Not authenticated/i, 'Not authenticated'],
  [/Username not available/i, 'Username not found'],
  [/failed to receive response/i, 'Response timed out'],
  [/failed to send request/i, 'Request timed out'],
  [/error sending request/i, 'Network unreachable'],
  [/could not resolve host|name.*resolution/i, 'DNS resolution failed'],
  [/connection refused/i, 'Connection refused'],
  [/connection reset/i, 'Connection reset'],
  [/操作超时|timed?\s*out|timeout/i, 'Network timed out'],
  [/SSL|certificate/i, 'SSL error'],
  [/401|unauthorized/i, 'Auth expired, reconnect'],
  [/403|forbidden/i, 'Permission denied'],
  [/404|not found/i, 'Repo not found'],
  [/409|conflict/i, 'Sync conflict'],
  [/422|already exists/i, 'Repo already exists'],
  [/rate limit|429/i, 'Rate limited, try later'],
  [/non-fast-forward/i, 'Remote changed, retrying'],
  [/Failed to copy|Failed to restore/i, 'File copy failed'],
  [/Failed to create backup/i, 'Backup failed'],
  [/Repository not found at/i, 'Local repo missing'],
  [/No GitHub token/i, 'Token missing'],
  [/failed to bind|Port may be in use/i, 'Auth port in use'],
  [/Git error:/i, 'Git operation failed'],
  [/IO error:/i, 'File system error'],
];

export function friendlySyncError(raw: string): string {
  for (const [pattern, message] of ERROR_MAP) {
    if (pattern.test(raw)) return message;
  }
  if (raw.length > 40) return raw.slice(0, 37) + '...';
  return raw;
}

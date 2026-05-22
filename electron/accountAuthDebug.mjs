const SENSITIVE_KEY_PATTERN = /(token|secret|verifier|code|state|challenge)/i;
const STATUS_CODE_PATTERN = /statuscode/i;

function abbreviate(value) {
  if (typeof value !== 'string') {
    return value;
  }
  if (value.length <= 4) {
    return '…';
  }
  if (/^\d+$/.test(value)) {
    return `${value.slice(0, 2)}…${value.slice(-2)}`;
  }
  if (/^(nts|rat)_/.test(value)) {
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
  }
  if (value.startsWith('secret_')) {
    return `secret…${value.slice(-4)}`;
  }
  if (value.startsWith('oauth-')) {
    return `oauth-…${value.slice(-4)}`;
  }
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function shouldRedactKey(key) {
  return SENSITIVE_KEY_PATTERN.test(key) && !STATUS_CODE_PATTERN.test(key);
}

function summarizeUrl(value) {
  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, url.pathname === '/' ? '/' : '');
  } catch {
    return abbreviate(value);
  }
}

export function summarizeAuthPayload(value, key = '') {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (/url$/i.test(key)) {
      return summarizeUrl(value);
    }
    return shouldRedactKey(key) ? abbreviate(value) : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => summarizeAuthPayload(item, key));
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      summarizeAuthPayload(entryValue, entryKey),
    ]),
  );
}

export function summarizeJsonPayload(value) {
  if (Array.isArray(value)) {
    return { type: 'array', length: value.length };
  }
  if (value && typeof value === 'object') {
    return { type: 'object', keys: Object.keys(value) };
  }
  return { type: value === null ? 'null' : typeof value };
}

export function summarizeRequestBody(body) {
  if (typeof body !== 'string') {
    return { type: typeof body };
  }

  try {
    return {
      type: 'json',
      value: summarizeAuthPayload(JSON.parse(body)),
      length: body.length,
    };
  } catch {
    return { type: 'text', length: body.length };
  }
}

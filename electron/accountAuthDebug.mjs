const SENSITIVE_KEY_PATTERN = /(token|secret|verifier|code|state|challenge)/i;
const STATUS_CODE_PATTERN = /statuscode/i;
const MAX_DEBUG_REQUEST_BODY_JSON_CHARS = 64 * 1024;
const MAX_DEBUG_PAYLOAD_DEPTH = 12;
const MAX_DEBUG_PAYLOAD_NODES = 1000;
const MAX_DEBUG_COLLECTION_ITEMS = 100;
const TRUNCATED_DEBUG_VALUE = '[Truncated]';

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

function summarizeAuthPayloadValue(value, key, state, depth) {
  state.nodes += 1;
  if (state.nodes > MAX_DEBUG_PAYLOAD_NODES || depth > MAX_DEBUG_PAYLOAD_DEPTH) {
    return TRUNCATED_DEBUG_VALUE;
  }

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
    return value
      .slice(0, MAX_DEBUG_COLLECTION_ITEMS)
      .map((item) => summarizeAuthPayloadValue(item, key, state, depth + 1));
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).slice(0, MAX_DEBUG_COLLECTION_ITEMS).map(([entryKey, entryValue]) => [
      entryKey,
      summarizeAuthPayloadValue(entryValue, entryKey, state, depth + 1),
    ]),
  );
}

export function summarizeAuthPayload(value, key = '') {
  return summarizeAuthPayloadValue(value, key, { nodes: 0 }, 0);
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

  if (body.length > MAX_DEBUG_REQUEST_BODY_JSON_CHARS) {
    return { type: 'text', length: body.length };
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

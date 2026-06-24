import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';

const MAX_FIELD_CHARS = 32 * 1024;
const MAX_RENDERER_DETAILS_CHARS = 128 * 1024;
const UNSAFE_LOG_FIELD_CHARS_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function getLogsDir(app) {
  return path.join(app.getPath('userData'), '.vlaina', 'app', 'logs');
}

function getCurrentLogFilePath(app, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return path.join(getLogsDir(app), `vlaina-error-${day}.log`);
}

function normalizeLogText(value, maxChars = MAX_FIELD_CHARS) {
  if (value == null) {
    return '';
  }

  const text = typeof value === 'string'
    ? value
    : util.inspect(value, { depth: 6, breakLength: 120 });
  const cleaned = text.replace(UNSAFE_LOG_FIELD_CHARS_PATTERN, '');
  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxChars)}\n...[truncated ${cleaned.length - maxChars} chars]`;
}

function serializeError(error, depth = 0) {
  if (depth > 4) {
    return {
      name: 'Error',
      message: 'Nested error cause omitted.',
      stack: '',
      cause: null,
    };
  }

  if (error instanceof Error) {
    return {
      name: normalizeLogText(error.name),
      message: normalizeLogText(error.message),
      stack: normalizeLogText(error.stack),
      cause: error.cause && error.cause !== error ? serializeError(error.cause, depth + 1) : null,
    };
  }

  return {
    name: typeof error,
    message: normalizeLogText(error),
    stack: '',
    cause: null,
  };
}

function normalizeRendererPayload(payload) {
  const detail = payload && typeof payload === 'object' ? payload : {};
  return {
    source: normalizeLogText(detail.source || 'renderer'),
    type: normalizeLogText(detail.type || 'error'),
    message: normalizeLogText(detail.message),
    name: normalizeLogText(detail.name),
    stack: normalizeLogText(detail.stack, MAX_RENDERER_DETAILS_CHARS),
    componentStack: normalizeLogText(detail.componentStack, MAX_RENDERER_DETAILS_CHARS),
    href: normalizeLogText(detail.href),
    userAgent: normalizeLogText(detail.userAgent),
    language: normalizeLogText(detail.language),
    languages: Array.isArray(detail.languages)
      ? detail.languages.map((language) => normalizeLogText(language, 512)).slice(0, 16)
      : [],
    platform: normalizeLogText(detail.platform),
    viewport: detail.viewport && typeof detail.viewport === 'object'
      ? {
          width: Number.isFinite(detail.viewport.width) ? detail.viewport.width : null,
          height: Number.isFinite(detail.viewport.height) ? detail.viewport.height : null,
          devicePixelRatio: Number.isFinite(detail.viewport.devicePixelRatio)
            ? detail.viewport.devicePixelRatio
            : null,
        }
      : null,
    online: typeof detail.online === 'boolean' ? detail.online : null,
    timestamp: normalizeLogText(detail.timestamp),
  };
}

function collectProcessDiagnostics(app) {
  const memoryUsage = process.memoryUsage();
  const safeCall = (callback, fallback = '') => {
    try {
      return callback();
    } catch {
      return fallback;
    }
  };

  return {
    appName: typeof app.getName === 'function' ? normalizeLogText(safeCall(() => app.getName(), 'vlaina')) : 'vlaina',
    appVersion: typeof app.getVersion === 'function' ? normalizeLogText(safeCall(() => app.getVersion(), 'unknown')) : 'unknown',
    isPackaged: Boolean(app.isPackaged),
    locale: typeof app.getLocale === 'function' ? normalizeLogText(safeCall(() => app.getLocale())) : '',
    userDataPath: normalizeLogText(safeCall(() => app.getPath('userData'))),
    logsDir: normalizeLogText(safeCall(() => getLogsDir(app))),
    execPath: normalizeLogText(process.execPath),
    resourcesPath: normalizeLogText(process.resourcesPath),
    cwd: normalizeLogText(process.cwd()),
    pid: process.pid,
    ppid: process.ppid,
    versions: {
      electron: normalizeLogText(process.versions.electron),
      chrome: normalizeLogText(process.versions.chrome),
      node: normalizeLogText(process.versions.node),
      v8: normalizeLogText(process.versions.v8),
    },
    memoryUsage: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers,
    },
  };
}

function buildLogEntry({ app, processType, error, payload, context }) {
  const now = new Date();
  let appVersion = 'unknown';
  try {
    appVersion = typeof app.getVersion === 'function' ? app.getVersion() : 'unknown';
  } catch {
  }

  return {
    timestamp: now.toISOString(),
    appVersion,
    platform: process.platform,
    arch: process.arch,
    processType,
    context: normalizeLogText(context),
    diagnostics: collectProcessDiagnostics(app),
    error: error === undefined ? null : serializeError(error),
    renderer: payload === undefined ? null : normalizeRendererPayload(payload),
  };
}

export function createErrorLogService({ app }) {
  function getInfo() {
    const logsDir = getLogsDir(app);
    return {
      logsDir,
      currentLogFilePath: getCurrentLogFilePath(app),
    };
  }

  function appendEntry(entry) {
    try {
      const { currentLogFilePath } = getInfo();
      fs.mkdirSync(path.dirname(currentLogFilePath), { recursive: true });
      fs.appendFileSync(currentLogFilePath, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
      return currentLogFilePath;
    } catch (writeError) {
      console.error('[vlaina] Failed to write error log:', writeError);
      return null;
    }
  }

  function logMainError(error, context = 'main') {
    return appendEntry(buildLogEntry({ app, processType: 'main', error, context }));
  }

  function logRendererError(payload, context = 'renderer') {
    return appendEntry(buildLogEntry({ app, processType: 'renderer', payload, context }));
  }

  return {
    getInfo,
    logMainError,
    logRendererError,
  };
}

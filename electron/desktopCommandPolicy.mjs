import path from 'node:path';

export const MAX_DESKTOP_COMMAND_CHARS = 2048;
export const MAX_DESKTOP_COMMAND_CWD_CHARS = 4096;
export const MAX_DESKTOP_COMMAND_PURPOSE_CHARS = 500;
export const DEFAULT_DESKTOP_COMMAND_TIMEOUT_MS = 10 * 60 * 1000;
export const MAX_DESKTOP_COMMAND_TIMEOUT_MS = 30 * 60 * 1000;

const UNSAFE_DISPLAY_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\uFFFD]/u;
const SAFE_ENV_KEYS = new Set([
  'APPDATA',
  'COLORTERM',
  'COMSPEC',
  'HOME',
  'HOMEDRIVE',
  'HOMEPATH',
  'LANG',
  'LANGUAGE',
  'LC_ALL',
  'LC_CTYPE',
  'LOCALAPPDATA',
  'LOGNAME',
  'NUMBER_OF_PROCESSORS',
  'OS',
  'PATH',
  'PATHEXT',
  'PROGRAMDATA',
  'PROGRAMFILES',
  'PROGRAMFILES(X86)',
  'PROGRAMW6432',
  'PUBLIC',
  'SHELL',
  'SYSTEMDRIVE',
  'SYSTEMROOT',
  'TEMP',
  'TERM',
  'TMP',
  'TMPDIR',
  'USER',
  'USERDOMAIN',
  'USERNAME',
  'USERPROFILE',
  'WINDIR',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_STATE_HOME',
]);

function requireBoundedSingleLine(value, label, maxChars) {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  if (normalized.length > maxChars) {
    throw new Error(`${label} is too long.`);
  }
  if (UNSAFE_DISPLAY_CHARS.test(normalized)) {
    throw new Error(`${label} contains unsupported control characters.`);
  }
  return normalized;
}

function optionalBoundedSingleLine(value, label, maxChars) {
  if (value == null || value === '') return '';
  return requireBoundedSingleLine(value, label, maxChars);
}

function normalizeTimeoutMs(value) {
  if (value == null) return DEFAULT_DESKTOP_COMMAND_TIMEOUT_MS;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Command timeout must be a finite number of seconds.');
  }
  const timeoutMs = Math.round(value * 1000);
  if (timeoutMs < 1000 || timeoutMs > MAX_DESKTOP_COMMAND_TIMEOUT_MS) {
    throw new Error('Command timeout must be between 1 and 1800 seconds.');
  }
  return timeoutMs;
}

export function normalizeDesktopCommandRequest(value, defaultCwd) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid desktop command request.');
  }
  const command = requireBoundedSingleLine(
    value.command,
    'Command',
    MAX_DESKTOP_COMMAND_CHARS,
  );
  const cwdInput = optionalBoundedSingleLine(
    value.cwd,
    'Working directory',
    MAX_DESKTOP_COMMAND_CWD_CHARS,
  );
  const purpose = requireBoundedSingleLine(
    value.purpose,
    'Command purpose',
    MAX_DESKTOP_COMMAND_PURPOSE_CHARS,
  );
  const normalizedDefaultCwd = requireBoundedSingleLine(
    defaultCwd,
    'Default working directory',
    MAX_DESKTOP_COMMAND_CWD_CHARS,
  );
  const rawLocale = typeof value.locale === 'string' && value.locale.length <= 32
    ? value.locale.toLowerCase()
    : '';

  return {
    command,
    cwd: path.resolve(normalizedDefaultCwd, cwdInput || '.'),
    purpose,
    locale: rawLocale.startsWith('zh')
      ? rawLocale.includes('hant') || rawLocale.includes('tw')
        ? 'zh-Hant'
        : 'zh-CN'
      : 'en',
    timeoutMs: normalizeTimeoutMs(value.timeoutSeconds),
  };
}

export function buildDesktopCommandEnvironment(source = process.env) {
  const environment = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== 'string' || !SAFE_ENV_KEYS.has(key.toUpperCase())) continue;
    environment[key] = value;
  }
  environment.NO_COLOR = '1';
  environment.FORCE_COLOR = '0';
  return environment;
}

export function getDesktopCommandRisk(command) {
  const dangerousPatterns = [
    /(^|[;&|]\s*)(sudo|doas|pkexec)\b/i,
    /\b(apt|apt-get|dnf|yum|pacman|zypper|brew|winget|choco|scoop)\b[^\n]*(install|remove|uninstall|upgrade|update)\b/i,
    /\b(rm\s+-[^\n]*r|rmdir\s+\/s|del\s+\/|format|diskpart|mkfs|shutdown|reboot)\b/i,
    /\b(systemctl|launchctl|sc\.exe|reg\.exe|bcdedit)\b/i,
    /\b(curl|wget)\b[^\n]*\|\s*(sh|bash|zsh|pwsh|powershell)\b/i,
    /\b(dd)\b[^\n]*\bof\s*=/i,
  ];
  return dangerousPatterns.some((pattern) => pattern.test(command)) ? 'elevated' : 'standard';
}

const ALWAYS_ALLOWED_READ_ONLY_COMMANDS = new Set([
  'df',
  'dir',
  'du',
  'file',
  'free',
  'id',
  'ls',
  'stat',
  'systeminfo',
  'uname',
  'uptime',
  'ver',
  'where',
  'whoami',
]);

const SIMPLE_ALWAYS_COMMAND_RE = /^[A-Za-z0-9._%+,:=@/\\ -]+$/;

export function canAlwaysAllowDesktopCommand(command) {
  if (typeof command !== 'string' || !SIMPLE_ALWAYS_COMMAND_RE.test(command)) {
    return false;
  }
  if (getDesktopCommandRisk(command) !== 'standard') {
    return false;
  }
  const executable = command.trim().split(/\s+/, 1)[0]?.toLowerCase() || '';
  if (!executable || executable.includes('/') || executable.includes('\\')) {
    return false;
  }
  return ALWAYS_ALLOWED_READ_ONLY_COMMANDS.has(executable);
}

export function getDesktopCommandShell(platform = process.platform, environment = process.env) {
  if (platform === 'win32') {
    const configuredRoot = environment.SystemRoot || environment.SYSTEMROOT;
    const systemRoot = typeof configuredRoot === 'string'
      && path.win32.isAbsolute(configuredRoot)
      && path.win32.basename(configuredRoot).toLowerCase() === 'windows'
      ? configuredRoot
      : 'C:\\Windows';
    return {
      shell: path.win32.join(systemRoot, 'System32', 'cmd.exe'),
      args: ['/d', '/s', '/c'],
    };
  }
  return { shell: '/bin/sh', args: ['-c'] };
}

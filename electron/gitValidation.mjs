import path from 'node:path';
import { sanitizeGitOutput } from './gitCommand.mjs';

const MAX_PATH_CHARS = 8192;

export function resolveRelativeGitPath(rootPath, filePath) {
  if (typeof filePath !== 'string' || !filePath || filePath.length > MAX_PATH_CHARS || filePath.includes('\0')) {
    throw new Error('A valid Git file path is required.');
  }

  const absolutePath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(rootPath, filePath);
  const relativePath = path.relative(rootPath, absolutePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Git file path must stay inside the repository.');
  }
  return relativePath;
}

export function requireSafeRemoteName(remoteName) {
  if (
    typeof remoteName !== 'string'
    || !remoteName
    || remoteName.startsWith('-')
    || /[\u0000-\u0020\u007F]/.test(remoteName)
  ) {
    throw new Error('Git remote name is invalid.');
  }
  return remoteName;
}

export function sanitizeRemoteUrl(remoteUrl) {
  const value = sanitizeGitOutput(remoteUrl).trim();
  if (!/^https?:\/\//i.test(value)) return value || null;
  try {
    const parsed = new URL(value);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return value || null;
  }
}

export function requireAllowedRemoteUrl(remoteUrl) {
  const value = String(remoteUrl ?? '').trim();
  if (/^[a-z]:/i.test(value)) {
    throw new Error('Git remote must use HTTPS or SSH.');
  }
  if (/^https:\/\//i.test(value)) {
    const parsed = new URL(value);
    if (!parsed.hostname || parsed.username || parsed.password) {
      throw new Error('Git HTTPS remote URL must not contain credentials.');
    }
    return value;
  }
  if (/^ssh:\/\//i.test(value)) {
    const parsed = new URL(value);
    if (!parsed.hostname || parsed.password) {
      throw new Error('Git SSH remote URL is invalid.');
    }
    return value;
  }
  if (/^(?:[^@\s/:]+@)?[^\s/:]+:.+$/.test(value)) {
    return value;
  }
  throw new Error('Git remote must use HTTPS or SSH.');
}

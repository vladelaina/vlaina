import { open, opendir, stat } from 'node:fs/promises';
import path from 'node:path';
import { assertAuthorizedFsPath } from './fsAccess.mjs';

const UNSAFE_DESKTOP_LIST_ENTRY_NAME_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const MAX_DESKTOP_FS_READ_BYTES = 64 * 1024 * 1024;
const MAX_DESKTOP_FS_WRITE_BYTES = MAX_DESKTOP_FS_READ_BYTES;
const MAX_DESKTOP_FS_LIST_DIR_ENTRIES = 20_000;
const MAX_DESKTOP_FS_LIST_DIR_SCAN_ENTRIES = MAX_DESKTOP_FS_LIST_DIR_ENTRIES * 2;
const DESKTOP_MARKDOWN_FILE_EXTENSION_PATTERN = /\.(?:md|markdown|mdown|mkd)$/i;
const LOW_PRIORITY_DESKTOP_DIRECTORY_NAMES = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '__pycache__',
]);

function normalizeDesktopReadByteLimit(value) {
  if (value == null) {
    return MAX_DESKTOP_FS_READ_BYTES;
  }
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_DESKTOP_FS_READ_BYTES) {
    throw new Error('Desktop read byte limit is invalid.');
  }
  return value;
}

async function assertReadableDesktopFile(filePath, maxBytes) {
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error(`Desktop path must be a file: ${filePath}`);
  }
  if (info.size > maxBytes) {
    throw new Error(`Desktop file is too large to read: ${filePath}`);
  }
}

export async function assertCopyableDesktopFile(filePath) {
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error(`Desktop path must be a file: ${filePath}`);
  }
  if (info.size > MAX_DESKTOP_FS_WRITE_BYTES) {
    throw new Error(`Desktop file is too large to copy: ${filePath}`);
  }
}

export async function readDesktopFileBytes(filePath, maxBytesValue) {
  const maxBytes = normalizeDesktopReadByteLimit(maxBytesValue);
  await assertReadableDesktopFile(filePath, maxBytes);

  const handle = await open(filePath, 'r');
  const chunks = [];
  let totalBytes = 0;
  try {
    while (totalBytes <= maxBytes) {
      const remainingBytes = maxBytes + 1 - totalBytes;
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, Math.max(1, remainingBytes)));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) {
        break;
      }
      chunks.push(buffer.subarray(0, bytesRead));
      totalBytes += bytesRead;
    }
  } finally {
    await handle.close().catch(() => {});
  }

  if (totalBytes > maxBytes) {
    throw new Error(`Desktop file is too large to read: ${filePath}`);
  }
  return Buffer.concat(chunks, totalBytes);
}

export function assertWritableDesktopByteLength(byteLength) {
  if (!Number.isSafeInteger(byteLength) || byteLength > MAX_DESKTOP_FS_WRITE_BYTES) {
    throw new Error('Desktop content is too large to write.');
  }
}

export async function describeDesktopDirectoryEntry(parentPath, entry) {
  const entryPath = path.join(parentPath, entry.name);
  if (!entry.isSymbolicLink?.()) {
    return {
      name: entry.name,
      path: entryPath,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    };
  }

  try {
    const authorizedEntryPath = await assertAuthorizedFsPath(entryPath);
    const info = await stat(authorizedEntryPath);
    return {
      name: entry.name,
      path: entryPath,
      isDirectory: info.isDirectory(),
      isFile: info.isFile(),
    };
  } catch {
    return {
      name: entry.name,
      path: entryPath,
      isDirectory: false,
      isFile: false,
    };
  }
}

function getDesktopDirectoryEntryListPriority(entry) {
  const entryName = String(entry.name);
  if (
    !entryName ||
    entryName === '.' ||
    entryName === '..' ||
    entryName.includes('/') ||
    entryName.includes('\\') ||
    UNSAFE_DESKTOP_LIST_ENTRY_NAME_PATTERN.test(entryName)
  ) {
    return 4;
  }

  if (DESKTOP_MARKDOWN_FILE_EXTENSION_PATTERN.test(entry.name)) {
    return 0;
  }

  if (entry.isDirectory?.() || entry.isSymbolicLink?.()) {
    return LOW_PRIORITY_DESKTOP_DIRECTORY_NAMES.has(entryName.toLowerCase()) ? 2 : 1;
  }

  return 3;
}

export function prioritizeDesktopDirectoryEntriesForListing(entries) {
  return entries
    .map((entry, index) => ({ entry, index, priority: getDesktopDirectoryEntryListPriority(entry) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ entry }) => entry);
}

export async function readDesktopDirectoryEntriesForListing(directoryPath) {
  let directory = null;
  const entries = [];
  try {
    directory = await opendir(directoryPath);
    for await (const entry of directory) {
      entries.push(entry);
      if (entries.length >= MAX_DESKTOP_FS_LIST_DIR_SCAN_ENTRIES) {
        break;
      }
    }
  } finally {
    await directory?.close?.().catch(() => {});
  }
  return entries;
}

export function normalizeDesktopBinaryWriteBytes(bytes) {
  if (bytes instanceof Uint8Array) {
    assertWritableDesktopByteLength(bytes.byteLength);
    return Buffer.from(bytes);
  }

  if (Array.isArray(bytes)) {
    assertWritableDesktopByteLength(bytes.length);
    const normalized = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) {
      const byte = bytes[index];
      if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
        throw new Error('Desktop binary content must contain only byte values.');
      }
      normalized[index] = byte;
    }
    return Buffer.from(normalized);
  }

  throw new Error('Desktop binary content must be a byte array.');
}

export function normalizeDesktopTextWriteContent(content) {
  if (typeof content !== 'string') {
    throw new Error('Desktop text content must be a string.');
  }
  const text = content;
  assertWritableDesktopByteLength(Buffer.byteLength(text, 'utf8'));
  return text;
}

export { MAX_DESKTOP_FS_LIST_DIR_ENTRIES };

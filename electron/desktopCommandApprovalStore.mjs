import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ensurePrivateDirectory, writePrivateFile } from './privateFilePermissions.mjs';
import {
  canAlwaysAllowDesktopCommand,
  MAX_DESKTOP_COMMAND_CHARS,
  MAX_DESKTOP_COMMAND_CWD_CHARS,
} from './desktopCommandPolicy.mjs';

const STORE_VERSION = 2;
const MAX_APPROVALS = 256;
const MAX_STORE_BYTES = 2 * 1024 * 1024;
const HASH_RE = /^[a-f0-9]{64}$/;
const UNSAFE_STORED_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\uFFFD]/u;

export function desktopCommandApprovalFingerprint(request, platform = process.platform) {
  return createHash('sha256').update(JSON.stringify({
    version: STORE_VERSION,
    platform,
    command: request.command,
    cwd: request.cwd,
  })).digest('hex');
}

function approvalRecord(request, platform, createdAt = Date.now()) {
  return {
    id: desktopCommandApprovalFingerprint(request, platform),
    platform,
    command: request.command,
    cwd: request.cwd,
    createdAt,
  };
}

function normalizeStoredApproval(value, platform) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.platform !== platform) return null;
  if (
    typeof value.command !== 'string'
    || !value.command.trim()
    || value.command.length > MAX_DESKTOP_COMMAND_CHARS
    || UNSAFE_STORED_CHARS.test(value.command)
    || !canAlwaysAllowDesktopCommand(value.command)
  ) return null;
  if (
    typeof value.cwd !== 'string'
    || !value.cwd
    || value.cwd.length > MAX_DESKTOP_COMMAND_CWD_CHARS
    || UNSAFE_STORED_CHARS.test(value.cwd)
  ) return null;
  const createdAt = Number.isSafeInteger(value.createdAt) && value.createdAt >= 0
    ? value.createdAt
    : 0;
  const record = approvalRecord({ command: value.command, cwd: value.cwd }, platform, createdAt);
  return value.id === record.id ? record : null;
}

export function createDesktopCommandApprovalStore({
  app,
  platform = process.platform,
  readFileImpl = readFile,
  statImpl = stat,
  ensureDirectory = ensurePrivateDirectory,
  writeFile = writePrivateFile,
} = {}) {
  let approvals = new Map();
  let loaded = false;
  let loadPromise = null;
  let savePromise = Promise.resolve();
  const storePath = () => path.join(
    app.getPath('userData'),
    '.vlaina',
    'app',
    'permissions',
    'computer-commands.json',
  );

  const ensureLoaded = async () => {
    if (loaded) return;
    if (!loadPromise) {
      loadPromise = (async () => {
        try {
          const filePath = storePath();
          const info = await statImpl(filePath);
          if (!info.isFile() || info.size > MAX_STORE_BYTES) return;
          const content = await readFileImpl(filePath, 'utf8');
          if (Buffer.byteLength(content, 'utf8') > MAX_STORE_BYTES) return;
          const payload = JSON.parse(content);
          if (payload?.version !== STORE_VERSION || !Array.isArray(payload.approvals)) return;
          const next = new Map();
          for (const value of payload.approvals) {
            if (next.size >= MAX_APPROVALS) break;
            const record = normalizeStoredApproval(value, platform);
            if (record) next.set(record.id, record);
          }
          approvals = next;
        } catch {
          // Missing, legacy, or invalid permission stores start empty.
        } finally {
          loaded = true;
        }
      })();
    }
    await loadPromise;
  };

  const persist = async (next) => {
    const filePath = storePath();
    await ensureDirectory(path.dirname(filePath));
    await writeFile(filePath, JSON.stringify({
      version: STORE_VERSION,
      approvals: [...next.values()].sort((a, b) => a.id.localeCompare(b.id)),
    }, null, 2));
  };

  const enqueueSave = (operation) => {
    const queued = savePromise.catch(() => undefined).then(operation);
    savePromise = queued.then(() => undefined, () => undefined);
    return queued;
  };

  return {
    async isApproved(request) {
      await ensureLoaded();
      await savePromise;
      return approvals.has(desktopCommandApprovalFingerprint(request, platform));
    },
    async list() {
      await ensureLoaded();
      await savePromise;
      return [...approvals.values()]
        .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
        .map(({ id, command, cwd, createdAt }) => ({ id, command, cwd, createdAt }));
    },
    async remember(request) {
      await ensureLoaded();
      if (!canAlwaysAllowDesktopCommand(request?.command)) {
        throw new Error('This computer command cannot be persistently approved.');
      }
      const record = approvalRecord(request, platform);
      await enqueueSave(async () => {
        if (approvals.has(record.id)) return;
        if (approvals.size >= MAX_APPROVALS) {
          throw new Error('Too many persistent computer command approvals.');
        }
        const next = new Map(approvals);
        next.set(record.id, record);
        await persist(next);
        approvals = next;
      });
    },
    async revoke(id) {
      await ensureLoaded();
      if (typeof id !== 'string' || !HASH_RE.test(id)) return false;
      return enqueueSave(async () => {
        if (!approvals.has(id)) return false;
        const next = new Map(approvals);
        next.delete(id);
        await persist(next);
        approvals = next;
        return true;
      });
    },
    async clear() {
      await ensureLoaded();
      return enqueueSave(async () => {
        if (approvals.size === 0) return false;
        const next = new Map();
        await persist(next);
        approvals = next;
        return true;
      });
    },
  };
}

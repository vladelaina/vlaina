import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ensurePrivateDirectory, writePrivateFile } from './privateFilePermissions.mjs';

const MAX_APPROVALS = 256;
const MAX_STORE_BYTES = 32 * 1024;
const HASH_RE = /^[a-f0-9]{64}$/;

export function desktopCommandApprovalFingerprint(request, platform = process.platform) {
  return createHash('sha256').update(JSON.stringify({
    version: 1,
    platform,
    command: request.command,
    cwd: request.cwd,
  })).digest('hex');
}

export function createDesktopCommandApprovalStore({
  app,
  platform = process.platform,
  readFileImpl = readFile,
  statImpl = stat,
  ensureDirectory = ensurePrivateDirectory,
  writeFile = writePrivateFile,
} = {}) {
  const approvals = new Set();
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
          for (const value of Array.isArray(payload?.approvals) ? payload.approvals : []) {
            if (approvals.size >= MAX_APPROVALS) break;
            if (typeof value === 'string' && HASH_RE.test(value)) approvals.add(value);
          }
        } catch {
          // Missing or invalid permission stores start empty.
        } finally {
          loaded = true;
        }
      })();
    }
    await loadPromise;
  };

  return {
    async isApproved(request) {
      await ensureLoaded();
      return approvals.has(desktopCommandApprovalFingerprint(request, platform));
    },
    async remember(request) {
      await ensureLoaded();
      const fingerprint = desktopCommandApprovalFingerprint(request, platform);
      savePromise = savePromise.catch(() => undefined).then(async () => {
        if (approvals.has(fingerprint)) return;
        if (approvals.size >= MAX_APPROVALS) {
          throw new Error('Too many persistent computer command approvals.');
        }
        const nextApprovals = [...approvals, fingerprint].sort();
        const filePath = storePath();
        await ensureDirectory(path.dirname(filePath));
        await writeFile(filePath, JSON.stringify({
          version: 1,
          approvals: nextApprovals,
        }, null, 2));
        approvals.add(fingerprint);
      });
      await savePromise;
    },
  };
}

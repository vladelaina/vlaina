import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createDesktopCommandApprovalStore,
  desktopCommandApprovalFingerprint,
} from '../../electron/desktopCommandApprovalStore.mjs';

describe('desktop command approval store', () => {
  let tempDir = '';
  const request = { command: 'uname -a', cwd: '/tmp/project' };

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'vlaina-command-approval-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('persists only an exact command and working-directory fingerprint', async () => {
    const app = { getPath: () => tempDir };
    const store = createDesktopCommandApprovalStore({ app, platform: 'linux' });

    expect(await store.isApproved(request)).toBe(false);
    await store.remember(request);
    expect(await store.isApproved(request)).toBe(true);
    expect(await store.isApproved({ ...request, command: 'uname -r' })).toBe(false);
    expect(await store.isApproved({ ...request, cwd: '/tmp/other' })).toBe(false);

    const savedPath = path.join(tempDir, '.vlaina', 'app', 'permissions', 'computer-commands.json');
    const saved = await readFile(savedPath, 'utf8');
    expect(saved).toContain(desktopCommandApprovalFingerprint(request, 'linux'));
    expect(saved).not.toContain('uname -a');
    expect(saved).not.toContain('/tmp/project');
  });

  it('reloads valid fingerprints and ignores malformed entries', async () => {
    const app = { getPath: () => tempDir };
    const first = createDesktopCommandApprovalStore({ app, platform: 'linux' });
    await first.remember(request);
    const second = createDesktopCommandApprovalStore({ app, platform: 'linux' });

    expect(await second.isApproved(request)).toBe(true);
  });

  it('does not keep an approval in memory when persistence fails', async () => {
    const store = createDesktopCommandApprovalStore({
      app: { getPath: () => tempDir },
      platform: 'linux',
      writeFile: async () => {
        throw new Error('write failed');
      },
    });

    await expect(store.remember(request)).rejects.toThrow('write failed');
    expect(await store.isApproved(request)).toBe(false);
  });
});

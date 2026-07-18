import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

  it('persists a manageable exact command and working-directory record', async () => {
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
    expect(saved).toContain('uname -a');
    expect(saved).toContain('/tmp/project');
    expect(await store.list()).toEqual([
      expect.objectContaining({
        id: desktopCommandApprovalFingerprint(request, 'linux'),
        command: 'uname -a',
        cwd: '/tmp/project',
      }),
    ]);
  });

  it('reloads valid records and rejects tampered approval metadata', async () => {
    const app = { getPath: () => tempDir };
    const first = createDesktopCommandApprovalStore({ app, platform: 'linux' });
    await first.remember(request);
    const second = createDesktopCommandApprovalStore({ app, platform: 'linux' });

    expect(await second.isApproved(request)).toBe(true);

    const savedPath = path.join(tempDir, '.vlaina', 'app', 'permissions', 'computer-commands.json');
    const payload = JSON.parse(await readFile(savedPath, 'utf8'));
    payload.approvals[0].command = 'uname -r';
    await writeFile(savedPath, JSON.stringify(payload));

    const tampered = createDesktopCommandApprovalStore({ app, platform: 'linux' });
    expect(await tampered.list()).toEqual([]);
    expect(await tampered.isApproved(request)).toBe(false);
  });

  it('revokes one approval or clears all approvals', async () => {
    const app = { getPath: () => tempDir };
    const store = createDesktopCommandApprovalStore({ app, platform: 'linux' });
    const second = { command: 'git status --short', cwd: '/tmp/project' };
    await store.remember(request);
    await store.remember(second);

    expect(await store.revoke(desktopCommandApprovalFingerprint(request, 'linux'))).toBe(true);
    expect(await store.isApproved(request)).toBe(false);
    expect(await store.isApproved(second)).toBe(true);
    expect(await store.clear()).toBe(true);
    expect(await store.list()).toEqual([]);
    expect(await store.isApproved(second)).toBe(false);
  });

  it('invalidates legacy hash-only approvals after the policy expansion', async () => {
    const savedPath = path.join(tempDir, '.vlaina', 'app', 'permissions', 'computer-commands.json');
    await mkdir(path.dirname(savedPath), { recursive: true });
    await writeFile(savedPath, JSON.stringify({
      version: 1,
      approvals: ['a'.repeat(64)],
    }));

    const store = createDesktopCommandApprovalStore({
      app: { getPath: () => tempDir },
      platform: 'linux',
    });
    expect(await store.list()).toEqual([]);
    expect(await store.isApproved(request)).toBe(false);
  });

  it('refuses to save critical commands even when called outside the IPC policy', async () => {
    const unsafeRequest = { command: 'sudo uname -a', cwd: '/tmp/project' };
    const store = createDesktopCommandApprovalStore({
      app: { getPath: () => tempDir },
      platform: 'linux',
    });

    await expect(store.remember(unsafeRequest))
      .rejects.toThrow('cannot be persistently approved');
    expect(await store.list()).toEqual([]);

    const savedPath = path.join(tempDir, '.vlaina', 'app', 'permissions', 'computer-commands.json');
    await mkdir(path.dirname(savedPath), { recursive: true });
    await writeFile(savedPath, JSON.stringify({
      version: 2,
      approvals: [{
        id: desktopCommandApprovalFingerprint(unsafeRequest, 'linux'),
        platform: 'linux',
        ...unsafeRequest,
        createdAt: 1,
      }],
    }));
    const reloaded = createDesktopCommandApprovalStore({
      app: { getPath: () => tempDir },
      platform: 'linux',
    });
    expect(await reloaded.list()).toEqual([]);
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

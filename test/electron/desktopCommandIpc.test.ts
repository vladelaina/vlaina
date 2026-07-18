import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, realpath, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  registerDesktopCommandIpc,
  resetDesktopCommandsForTests,
} from '../../electron/desktopCommandIpc.mjs';

function safeId(value: unknown): string {
  const id = typeof value === 'string' ? value : '';
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(id)) throw new Error('unsafe id');
  return id;
}

describe('desktop command ipc', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vlaina-command-ipc-')));
    resetDesktopCommandsForTests();
  });

  afterEach(async () => {
    resetDesktopCommandsForTests();
    await rm(tempDir, { recursive: true, force: true });
  });

  function registerHarness(options: {
    decision?: 'run_once' | 'always' | 'cancel';
    persistentApproved?: boolean;
    isProtectedPath?: (candidatePath: string) => Promise<boolean>;
    runProcess?: (...args: any[]) => Promise<Record<string, unknown>>;
    captureSnapshot?: (...args: any[]) => Promise<unknown>;
    compareSnapshots?: (...args: any[]) => { changes: unknown[]; truncated: boolean };
  } = {}) {
    const handlers = new Map<string, (...args: any[]) => unknown>();
    const approvalStore = {
      isApproved: vi.fn(async () => options.persistentApproved === true),
      list: vi.fn(async () => []),
      remember: vi.fn(async () => undefined),
      revoke: vi.fn(async () => true),
      clear: vi.fn(async () => true),
    };
    const runProcess = vi.fn(options.runProcess ?? (async (_request, runtimeOptions) => {
      runtimeOptions.onOutput({ stream: 'stdout', text: 'done\n' });
      return {
        status: 'completed',
        exitCode: 0,
        signal: null,
        stdout: 'done\n',
        stderr: '',
        truncated: false,
        durationMs: 5,
      };
    }));
    const app = { getPath: () => tempDir, on: vi.fn() };
    registerDesktopCommandIpc({
      app,
      approvalStore,
      handleIpc: (channel, handler) => handlers.set(channel, handler),
      isProtectedPath: options.isProtectedPath ?? (async () => false),
      requireSafeIpcRequestId: safeId,
      runProcess,
      captureSnapshot: options.captureSnapshot,
      compareSnapshots: options.compareSnapshots,
    });
    const createSender = (decision: 'run_once' | 'always' | 'cancel' | null = options.decision ?? 'run_once') => {
      const activeSender = {
        isDestroyed: () => false,
        once: vi.fn(),
        removeListener: vi.fn(),
        send: vi.fn((channel: string, payload: { type?: string }) => {
          if (payload?.type === 'approval_requested' && decision) {
            const requestId = channel.split(':').at(-2) || '';
            queueMicrotask(() => {
              void handlers.get('desktop:computer-command:approve')?.(
                { sender: activeSender },
                requestId,
                decision,
              );
            });
          }
        }),
      };
      return activeSender;
    };
    return { app, approvalStore, createSender, handlers, runProcess };
  }

  it('requires renderer approval and does not run a denied command', async () => {
    const { createSender, handlers, runProcess } = registerHarness({ decision: 'cancel' });
    const activeSender = createSender();
    const result = await handlers.get('desktop:computer-command:start')?.(
      { sender: activeSender },
      'request-1',
      { command: 'echo safe', cwd: tempDir, purpose: 'Check output', locale: 'zh-CN' },
    );

    expect(result).toMatchObject({ status: 'denied', command: 'echo safe', cwd: tempDir });
    expect(runProcess).not.toHaveBeenCalled();
    expect(activeSender.send).toHaveBeenCalledWith(
      'desktop:computer-command:request-1:event',
      expect.objectContaining({
        type: 'approval_requested',
        command: 'echo safe',
        cwd: tempDir,
        purpose: 'Check output',
        canAlwaysAllow: true,
      }),
    );
  });

  it('lists and revokes saved approvals through bounded IPC operations', async () => {
    const { approvalStore, handlers } = registerHarness();
    const approval = {
      id: 'a'.repeat(64),
      command: 'git status --short',
      cwd: tempDir,
      createdAt: 1,
    };
    approvalStore.list.mockResolvedValueOnce([approval]);

    await expect(handlers.get('desktop:computer-command:approvals:list')?.({}))
      .resolves.toEqual([approval]);
    await expect(handlers.get('desktop:computer-command:approvals:revoke')?.({}, approval.id))
      .resolves.toBe(true);
    await expect(handlers.get('desktop:computer-command:approvals:clear')?.({}))
      .resolves.toBe(true);

    expect(approvalStore.revoke).toHaveBeenCalledWith(approval.id);
    expect(approvalStore.clear).toHaveBeenCalledTimes(1);
    await expect(handlers.get('desktop:computer-command:approvals:revoke')?.({}, '../unsafe'))
      .rejects.toThrow('unsafe id');
  });

  it('runs the frozen approved command and streams bounded events to its sender', async () => {
    const { createSender, handlers, runProcess } = registerHarness();
    const activeSender = createSender();
    const result = await handlers.get('desktop:computer-command:start')?.(
      { sender: activeSender },
      'request-2',
      { command: 'printf ok', cwd: tempDir, purpose: 'Print output' },
    );

    expect(result).toMatchObject({ status: 'completed', command: 'printf ok', cwd: tempDir });
    expect(runProcess).toHaveBeenCalledWith(expect.objectContaining({
      command: 'printf ok',
      cwd: tempDir,
      env: expect.objectContaining({ NO_COLOR: '1', FORCE_COLOR: '0' }),
    }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(activeSender.send).toHaveBeenCalledWith(
      'desktop:computer-command:request-2:event',
      { type: 'started' },
    );
    expect(activeSender.send).toHaveBeenCalledWith(
      'desktop:computer-command:request-2:event',
      { type: 'output', stream: 'stdout', text: 'done\n' },
    );
  });

  it('persists an exact project-install approval', async () => {
    const { approvalStore, createSender, handlers, runProcess } = registerHarness({ decision: 'always' });
    const activeSender = createSender();

    await expect(handlers.get('desktop:computer-command:start')?.(
      { sender: activeSender },
      'request-always',
      { command: 'pnpm install', cwd: tempDir, purpose: 'Install project dependencies' },
    )).resolves.toMatchObject({ status: 'completed' });

    expect(approvalStore.remember).toHaveBeenCalledWith(expect.objectContaining({
      command: 'pnpm install',
      cwd: tempDir,
    }));
    expect(runProcess).toHaveBeenCalledTimes(1);
    expect(activeSender.send).toHaveBeenCalledWith(
      'desktop:computer-command:request-always:event',
      expect.objectContaining({ type: 'approval_requested', canAlwaysAllow: true }),
    );
  });

  it('denies forged persistent approval for critical commands', async () => {
    const { approvalStore, createSender, handlers, runProcess } = registerHarness({ decision: 'always' });

    await expect(handlers.get('desktop:computer-command:start')?.(
      { sender: createSender() },
      'request-unsafe-always',
      { command: 'rm -rf ./cache', cwd: tempDir, purpose: 'Clear generated files' },
    )).resolves.toMatchObject({ status: 'denied' });

    expect(approvalStore.remember).not.toHaveBeenCalled();
    expect(runProcess).not.toHaveBeenCalled();
  });

  it('accepts approval responses only from the renderer that owns the request', async () => {
    const { createSender, handlers, runProcess } = registerHarness();
    const owner = createSender(null);
    const stranger = createSender(null);
    const running = handlers.get('desktop:computer-command:start')?.(
      { sender: owner },
      'request-owner-approval',
      { command: 'uname -a', cwd: tempDir, purpose: 'Inspect the system' },
    );
    await vi.waitFor(() => {
      expect(owner.send).toHaveBeenCalledWith(
        'desktop:computer-command:request-owner-approval:event',
        expect.objectContaining({ type: 'approval_requested' }),
      );
    });

    await expect(handlers.get('desktop:computer-command:approve')?.(
      { sender: stranger },
      'request-owner-approval',
      'run_once',
    )).resolves.toBe(false);
    expect(runProcess).not.toHaveBeenCalled();
    await expect(handlers.get('desktop:computer-command:approve')?.(
      { sender: owner },
      'request-owner-approval',
      'run_once',
    )).resolves.toBe(true);
    await expect(running).resolves.toMatchObject({ status: 'completed' });
  });

  it('reuses a stored approval only while the command remains eligible', async () => {
    const { createSender, handlers, runProcess } = registerHarness({ persistentApproved: true });
    const safeSender = createSender();
    const unsafeSender = createSender('cancel');

    await expect(handlers.get('desktop:computer-command:start')?.(
      { sender: safeSender },
      'request-stored-safe',
      { command: 'uname -a', cwd: tempDir, purpose: 'Inspect the system' },
    )).resolves.toMatchObject({ status: 'completed' });
    await expect(handlers.get('desktop:computer-command:start')?.(
      { sender: unsafeSender },
      'request-stored-unsafe',
      { command: 'rm -rf ./cache', cwd: tempDir, purpose: 'Clear generated files' },
    )).resolves.toMatchObject({ status: 'denied' });

    expect(safeSender.send).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ type: 'approval_requested' }),
    );
    expect(unsafeSender.send).toHaveBeenCalledWith(
      'desktop:computer-command:request-stored-unsafe:event',
      expect.objectContaining({ type: 'approval_requested', canAlwaysAllow: false }),
    );
    expect(runProcess).toHaveBeenCalledTimes(1);
  });

  it('returns locally captured file changes after an approved command', async () => {
    const captureSnapshot = vi.fn()
      .mockResolvedValueOnce({ version: 'before' })
      .mockResolvedValueOnce({ version: 'after' });
    const compareSnapshots = vi.fn(() => ({
      changes: [{
        path: 'src/app.ts',
        kind: 'modified',
        additions: 1,
        deletions: 1,
        patch: '@@ -1,1 +1,1 @@\n-old\n+new',
      }],
      truncated: false,
    }));
    const { createSender, handlers } = registerHarness({ captureSnapshot, compareSnapshots });

    const result = await handlers.get('desktop:computer-command:start')?.(
      { sender: createSender() },
      'request-changes',
      { command: 'printf ok', cwd: tempDir, purpose: 'Update a file' },
    );

    expect(captureSnapshot).toHaveBeenCalledTimes(2);
    expect(compareSnapshots).toHaveBeenCalledWith({ version: 'before' }, { version: 'after' });
    expect(result).toMatchObject({
      fileChanges: [expect.objectContaining({ path: 'src/app.ts', additions: 1, deletions: 1 })],
    });
  });

  it('does not start an approved command if cancellation arrives during the initial snapshot', async () => {
    let releaseSnapshot: () => void = () => {};
    const snapshot = new Promise((resolve) => {
      releaseSnapshot = () => resolve({ files: new Map(), truncated: false });
    });
    const captureSnapshot = vi.fn(() => snapshot);
    const { createSender, handlers, runProcess } = registerHarness({ captureSnapshot });
    const activeSender = createSender();
    const running = handlers.get('desktop:computer-command:start')?.(
      { sender: activeSender },
      'request-snapshot-cancel',
      { command: 'printf unsafe', cwd: tempDir, purpose: 'Wait for the snapshot' },
    );
    await vi.waitFor(() => expect(captureSnapshot).toHaveBeenCalledTimes(1));

    await expect(handlers.get('desktop:computer-command:cancel')?.(
      { sender: activeSender },
      'request-snapshot-cancel',
    )).resolves.toBe(true);
    releaseSnapshot();

    await expect(running).resolves.toMatchObject({ status: 'cancelled' });
    expect(runProcess).not.toHaveBeenCalled();
  });

  it('rejects missing working directories before showing approval', async () => {
    const { createSender, handlers, runProcess } = registerHarness();
    const activeSender = createSender();

    await expect(handlers.get('desktop:computer-command:start')?.(
      { sender: activeSender },
      'request-3',
      { command: 'echo no', cwd: path.join(tempDir, 'missing'), purpose: 'Check a missing directory' },
    )).rejects.toThrow('Command working directory is unavailable.');
    expect(activeSender.send).not.toHaveBeenCalled();
    expect(runProcess).not.toHaveBeenCalled();
  });

  it('reserves request ids before asynchronous path checks', async () => {
    let releasePathCheck: () => void = () => {};
    const pathCheck = new Promise<void>((resolve) => {
      releasePathCheck = resolve;
    });
    const isProtectedPath = vi.fn(async () => {
      await pathCheck;
      return false;
    });
    const { createSender, handlers } = registerHarness({ isProtectedPath });
    const activeSender = createSender();
    const first = handlers.get('desktop:computer-command:start')?.(
      { sender: activeSender },
      'request-race',
      { command: 'echo first', cwd: tempDir, purpose: 'Check the first request' },
    );

    await vi.waitFor(() => expect(isProtectedPath).toHaveBeenCalledTimes(1));
    await expect(handlers.get('desktop:computer-command:start')?.(
      { sender: activeSender },
      'request-race',
      { command: 'echo second', cwd: tempDir, purpose: 'Check the second request' },
    )).rejects.toThrow('already active');

    releasePathCheck();
    await expect(first).resolves.toMatchObject({ status: 'completed' });
  });

  it('enforces the concurrency limit while path checks are pending', async () => {
    let releasePathChecks: () => void = () => {};
    const pathChecks = new Promise<void>((resolve) => {
      releasePathChecks = resolve;
    });
    const isProtectedPath = vi.fn(async () => {
      await pathChecks;
      return false;
    });
    const { createSender, handlers } = registerHarness({ isProtectedPath });
    const activeSender = createSender();
    const running = Array.from({ length: 4 }, (_, index) => (
      handlers.get('desktop:computer-command:start')?.(
        { sender: activeSender },
        `request-limit-${index}`,
        { command: `echo ${index}`, cwd: tempDir, purpose: `Check request ${index}` },
      )
    ));

    await vi.waitFor(() => expect(isProtectedPath).toHaveBeenCalledTimes(4));
    await expect(handlers.get('desktop:computer-command:start')?.(
      { sender: activeSender },
      'request-limit-4',
      { command: 'echo blocked', cwd: tempDir, purpose: 'Exceed the command limit' },
    )).rejects.toThrow('Too many computer commands are active');

    releasePathChecks();
    await expect(Promise.all(running)).resolves.toHaveLength(4);
  });

  it.skipIf(process.platform === 'win32')('blocks working-directory symlinks that resolve into protected storage', async () => {
    const protectedDir = path.join(tempDir, 'protected');
    const linkedDir = path.join(tempDir, 'workspace-link');
    await mkdir(protectedDir);
    await symlink(protectedDir, linkedDir);
    const isProtectedPath = vi.fn(async (candidatePath: string) => path.basename(candidatePath) === 'protected');
    const { createSender, handlers, runProcess } = registerHarness({ isProtectedPath });
    const activeSender = createSender();

    await expect(handlers.get('desktop:computer-command:start')?.(
      { sender: activeSender },
      'request-symlink',
      { command: 'pwd', cwd: linkedDir, purpose: 'Print the working directory' },
    )).rejects.toThrow('reserved for internal desktop storage');

    expect(isProtectedPath).toHaveBeenCalledWith(linkedDir);
    expect(isProtectedPath).toHaveBeenCalledWith(protectedDir);
    expect(activeSender.send).not.toHaveBeenCalled();
    expect(runProcess).not.toHaveBeenCalled();
  });

  it('cancels only commands owned by the requesting renderer', async () => {
    const started = new Promise<void>((resolve) => {
      void mkdir(path.join(tempDir, 'ready')).then(() => resolve());
    });
    await started;
    let observedSignal: AbortSignal | null = null;
    const { createSender, handlers } = registerHarness({
      runProcess: async (_request, runtimeOptions) => {
        observedSignal = runtimeOptions.signal;
        return await new Promise((resolve) => {
          runtimeOptions.signal.addEventListener('abort', () => resolve({
            status: 'cancelled',
            exitCode: null,
            signal: null,
            stdout: '',
            stderr: '',
            truncated: false,
            durationMs: 1,
          }), { once: true });
        });
      },
    });
    const owner = createSender();
    const stranger = createSender();
    const running = handlers.get('desktop:computer-command:start')?.(
      { sender: owner },
      'request-4',
      { command: 'sleep 10', cwd: tempDir, purpose: 'Wait for cancellation' },
    );
    await vi.waitFor(() => expect(observedSignal).not.toBeNull());

    await expect(handlers.get('desktop:computer-command:cancel')?.(
      { sender: stranger },
      'request-4',
    )).resolves.toBe(false);
    expect(observedSignal?.aborted).toBe(false);
    await expect(handlers.get('desktop:computer-command:cancel')?.(
      { sender: owner },
      'request-4',
    )).resolves.toBe(true);
    await expect(running).resolves.toMatchObject({ status: 'cancelled' });
  });

  it('cancels active commands when the desktop app quits', async () => {
    let observedSignal: AbortSignal | null = null;
    const { app, createSender, handlers } = registerHarness({
      runProcess: async (_request, runtimeOptions) => {
        observedSignal = runtimeOptions.signal;
        return await new Promise((resolve) => {
          runtimeOptions.signal.addEventListener('abort', () => resolve({
            status: 'cancelled',
            exitCode: null,
            signal: null,
            stdout: '',
            stderr: '',
            truncated: false,
            durationMs: 1,
          }), { once: true });
        });
      },
    });
    const running = handlers.get('desktop:computer-command:start')?.(
      { sender: createSender() },
      'request-app-quit',
      { command: 'sleep 10', cwd: tempDir, purpose: 'Wait for app shutdown' },
    );
    await vi.waitFor(() => expect(observedSignal).not.toBeNull());

    const beforeQuit = app.on.mock.calls.find(([event]) => event === 'before-quit')?.[1];
    beforeQuit?.();

    expect(observedSignal?.aborted).toBe(true);
    expect(observedSignal?.reason).toBe('app_quit');
    await expect(running).resolves.toMatchObject({ status: 'cancelled' });
  });
});

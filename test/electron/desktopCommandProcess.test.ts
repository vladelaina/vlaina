import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { runDesktopCommandProcess, MAX_DESKTOP_COMMAND_OUTPUT_BYTES } from '../../electron/desktopCommandProcess.mjs';

const isWindows = process.platform === 'win32';

function request(command: string, timeoutMs = 5000) {
  return {
    command,
    cwd: process.cwd(),
    env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '', NO_COLOR: '1' },
    shell: '/bin/sh',
    shellArgs: ['-c'],
    timeoutMs,
  };
}

describe.skipIf(isWindows)('desktop command process', () => {
  it('captures stdout, stderr, exit code, and duration', async () => {
    const result = await runDesktopCommandProcess(request("printf 'out'; printf 'err' >&2"));

    expect(result).toMatchObject({
      status: 'completed',
      exitCode: 0,
      stdout: 'out',
      stderr: 'err',
      truncated: false,
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('bounds large process output returned to the model', async () => {
    const result = await runDesktopCommandProcess(request('yes x | head -c 70000'));

    expect(result.status).toBe('completed');
    expect(Buffer.byteLength(result.stdout, 'utf8')).toBeLessThanOrEqual(MAX_DESKTOP_COMMAND_OUTPUT_BYTES);
    expect(result.truncated).toBe(true);
  });

  it('terminates the process group when the request is cancelled', async () => {
    const controller = new AbortController();
    const startedAt = Date.now();
    const running = runDesktopCommandProcess(request('sleep 10', 15_000), {
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 30);

    await expect(running).resolves.toMatchObject({ status: 'cancelled' });
    expect(Date.now() - startedAt).toBeLessThan(3000);
  });

  it('terminates commands that exceed their timeout', async () => {
    const startedAt = Date.now();
    await expect(runDesktopCommandProcess(request('sleep 10', 30))).resolves.toMatchObject({
      status: 'timed_out',
    });
    expect(Date.now() - startedAt).toBeLessThan(3000);
  });
});

describe('desktop command process Windows termination', () => {
  it('uses the fixed System32 taskkill path instead of PATH lookup', async () => {
    const child = new EventEmitter() as EventEmitter & {
      pid: number;
      stdout: PassThrough;
      stderr: PassThrough;
    };
    child.pid = 123;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const killer = { unref: vi.fn() };
    const spawnImpl = vi.fn()
      .mockReturnValueOnce(child)
      .mockReturnValueOnce(killer);
    const controller = new AbortController();
    const running = runDesktopCommandProcess({
      ...request('echo ok'),
      shell: 'C:\\Windows\\System32\\cmd.exe',
      shellArgs: ['/d', '/s', '/c'],
    }, {
      platform: 'win32',
      signal: controller.signal,
      spawnImpl,
    });

    controller.abort();
    child.emit('close', null, 'SIGTERM');

    await expect(running).resolves.toMatchObject({ status: 'cancelled' });
    expect(spawnImpl).toHaveBeenNthCalledWith(
      2,
      'C:\\Windows\\System32\\taskkill.exe',
      ['/pid', '123', '/t', '/f'],
      { stdio: 'ignore', windowsHide: true },
    );
  });
});

describe.skipIf(isWindows)('desktop command process app shutdown', () => {
  it('force-kills the process group immediately when the app quits', async () => {
    const child = new EventEmitter() as EventEmitter & {
      pid: number;
      stdout: PassThrough;
      stderr: PassThrough;
      kill: ReturnType<typeof vi.fn>;
    };
    child.pid = 456;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = vi.fn();
    const spawnImpl = vi.fn().mockReturnValue(child);
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const controller = new AbortController();
    const running = runDesktopCommandProcess(request('sleep 10'), {
      platform: 'linux',
      signal: controller.signal,
      spawnImpl,
    });

    controller.abort('app_quit');
    child.emit('close', null, 'SIGKILL');

    await expect(running).resolves.toMatchObject({ status: 'cancelled' });
    expect(kill).toHaveBeenCalledWith(-456, 'SIGKILL');
    kill.mockRestore();
  });
});

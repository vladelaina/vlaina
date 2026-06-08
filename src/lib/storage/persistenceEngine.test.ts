import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPersistenceQueue } from './persistenceEngine';

describe('createPersistenceQueue', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('coalesces scheduled payloads and writes the latest value', async () => {
    vi.useFakeTimers();
    const write = vi.fn(async () => undefined);
    const queue = createPersistenceQueue<string>({ write, debounceMs: 50 });

    queue.schedule('first');
    queue.schedule('second');

    await vi.advanceTimersByTimeAsync(50);

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('second');
  });

  it('keeps failed payloads pending for retry while flush reports the failure', async () => {
    vi.useFakeTimers();
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error('disk busy'))
      .mockResolvedValueOnce(undefined);
    const onError = vi.fn();
    const queue = createPersistenceQueue<string>({
      write,
      debounceMs: 0,
      retryBaseMs: 100,
      onError,
    });

    queue.schedule('payload');
    await expect(queue.flush()).rejects.toThrow('disk busy');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(queue.hasPending()).toBe(true);

    await vi.advanceTimersByTimeAsync(100);

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith('payload');
    expect(queue.hasPending()).toBe(false);
  });

  it('replaces stale debounce timers with retry backoff when an in-flight write fails', async () => {
    vi.useFakeTimers();
    let rejectFirstWrite!: (error: Error) => void;
    const write = vi
      .fn()
      .mockImplementationOnce(() => new Promise((_resolve, reject) => {
        rejectFirstWrite = reject;
      }))
      .mockResolvedValue(undefined);
    const queue = createPersistenceQueue<string>({
      write,
      debounceMs: 0,
      retryBaseMs: 100,
    });

    queue.schedule('first');
    await vi.runOnlyPendingTimersAsync();
    expect(write).toHaveBeenCalledTimes(1);

    queue.schedule('second', { debounceMs: 50 });
    rejectFirstWrite(new Error('disk busy'));
    await Promise.resolve();
    await Promise.resolve();

    expect(queue.hasPending()).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(50);
    expect(write).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(50);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith('second');
  });

  it('cancels pending writes and reports idle after timers are cleared', () => {
    vi.useFakeTimers();
    const write = vi.fn(async () => undefined);
    const onIdle = vi.fn();
    const queue = createPersistenceQueue<string>({ write, debounceMs: 50, onIdle });

    queue.schedule('payload');
    queue.cancel();

    expect(queue.hasPending()).toBe(false);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(50);
    expect(write).not.toHaveBeenCalled();
  });

  it('does not retry an in-flight payload after it is canceled', async () => {
    vi.useFakeTimers();
    let rejectWrite!: (error: Error) => void;
    const write = vi.fn(() => new Promise<void>((_resolve, reject) => {
      rejectWrite = reject;
    }));
    const onError = vi.fn();
    const queue = createPersistenceQueue<string>({
      write,
      debounceMs: 0,
      retryBaseMs: 100,
      onError,
    });

    queue.schedule('payload');
    await vi.runOnlyPendingTimersAsync();
    expect(write).toHaveBeenCalledTimes(1);

    queue.cancel();
    rejectWrite(new Error('disk busy'));

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
      expect(queue.hasPending()).toBe(false);
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(write).toHaveBeenCalledTimes(1);
  });

});

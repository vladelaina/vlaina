import { describe, expect, it, vi } from 'vitest';
import { registerManagedIpc } from '../../electron/managedIpc.mjs';

function registerHarness(overrides: Partial<Parameters<typeof registerManagedIpc>[0]> = {}) {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const options = {
    handleIpc: (name: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(name, handler);
    },
    requestManagedJson: vi.fn(),
    fetchWithStoredSession: vi.fn(),
    managedApiBaseUrl: 'https://api.example.com/v1',
    createElectronBillingCheckout: vi.fn(),
    requireNonEmptyString: (value: unknown) => String(value ?? '').trim(),
    ...overrides,
  };

  registerManagedIpc(options);
  return { handlers, options };
}

function streamResponse(chunks: string[]) {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  }));
}

describe('managed ipc stream bridge', () => {
  it('rejects unsafe stream request ids before starting a request', async () => {
    const { handlers, options } = registerHarness();

    await expect(
      handlers.get('desktop:managed:chat-completion-stream:start')?.(
        { sender: { isDestroyed: () => false, send: vi.fn() } },
        'managed\nother',
        {},
      ),
    ).rejects.toThrow('safe channel characters');
    expect(options.fetchWithStoredSession).not.toHaveBeenCalled();
  });

  it('does not let an old stream cleanup remove a newer stream with the same id', async () => {
    let closeFirstStream!: () => void;
    const signals: AbortSignal[] = [];
    const firstStream = new ReadableStream<Uint8Array>({
      start(controller) {
        closeFirstStream = () => controller.close();
      },
    });
    const secondStream = new ReadableStream<Uint8Array>({ start() {} });
    const fetchWithStoredSession = vi
      .fn()
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        signals.push(init.signal as AbortSignal);
        return new Response(firstStream);
      })
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        signals.push(init.signal as AbortSignal);
        return new Response(secondStream);
      });
    const { handlers } = registerHarness({ fetchWithStoredSession });
    const sender = { isDestroyed: () => false, send: vi.fn() };

    await handlers.get('desktop:managed:chat-completion-stream:start')?.({ sender }, 'managed-1', {});
    await handlers.get('desktop:managed:chat-completion-stream:start')?.({ sender }, 'managed-1', {});
    closeFirstStream();
    await Promise.resolve();
    await Promise.resolve();

    await handlers.get('desktop:managed:chat-completion-stream:cancel')?.({}, 'managed-1');

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(true);
  });

  it('consumes the final SSE line without a trailing newline', async () => {
    const fetchWithStoredSession = vi.fn(async () => streamResponse([
      'data: {"choices":[{"delta":{"content":"final"}}]}',
    ]));
    const { handlers } = registerHarness({ fetchWithStoredSession });
    const sender = { isDestroyed: () => false, send: vi.fn() };

    await handlers.get('desktop:managed:chat-completion-stream:start')?.({ sender }, 'managed-final', {});
    await Promise.resolve();
    await Promise.resolve();

    expect(sender.send).toHaveBeenCalledWith('desktop:managed:stream:managed-final:chunk', 'final');
    expect(sender.send).toHaveBeenCalledWith('desktop:managed:stream:managed-final:done', { content: 'final' });
  });

  it('surfaces managed stream error payloads', async () => {
    const fetchWithStoredSession = vi.fn(async () => streamResponse([
      'data: {"error":{"message":"upstream failed"}}\n\n',
    ]));
    const { handlers } = registerHarness({ fetchWithStoredSession });
    const sender = { isDestroyed: () => false, send: vi.fn() };

    await handlers.get('desktop:managed:chat-completion-stream:start')?.({ sender }, 'managed-error', {});
    await Promise.resolve();
    await Promise.resolve();

    expect(sender.send).toHaveBeenCalledWith('desktop:managed:stream:managed-error:error', { message: 'upstream failed' });
  });
});

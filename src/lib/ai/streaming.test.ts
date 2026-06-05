import { describe, expect, it, vi } from 'vitest';
import {
  consumeOpenAIStream,
  MAX_OPENAI_STREAM_CONTENT_CHARS,
  MAX_OPENAI_STREAM_LINE_CHARS,
} from './streaming';

function streamResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(lines.join('\n')));
        controller.close();
      },
    }),
  );
}

describe('consumeOpenAIStream', () => {
  it('wraps OpenAI-compatible reasoning_content deltas in think tags', async () => {
    const chunks: string[] = [];
    const transcriptMessages: unknown[] = [];
    const result = await consumeOpenAIStream(
      streamResponse([
        'data: {"choices":[{"delta":{"role":"assistant","content":"","reasoning_content":"\\n"}}]}',
        '',
        'data: {"choices":[{"delta":{"role":"assistant","content":"","reasoning_content":"Got it"}}]}',
        '',
        'data: {"choices":[{"delta":{"role":"assistant","content":"p"}}]}',
        '',
        'data: {"choices":[{"delta":{"role":"assistant","content":"ong"}}]}',
        '',
        'data: [DONE]',
        '',
      ]),
      (chunk) => chunks.push(chunk),
      {
        onAssistantTranscriptMessage: (message) => transcriptMessages.push(message),
      },
    );

    expect(result).toBe('<think>\nGot it</think>pong');
    expect(chunks).toContain('<think>\nGot it');
    expect(chunks[chunks.length - 1]).toBe('<think>\nGot it</think>pong');
    expect(transcriptMessages).toEqual([{
      role: 'assistant',
      content: 'pong',
      reasoning_content: '\nGot it',
    }]);
  });

  it('keeps resumed reasoning hidden after visible content has started', async () => {
    const chunks: string[] = [];
    const transcriptMessages: unknown[] = [];
    const result = await consumeOpenAIStream(
      streamResponse([
        'data: {"choices":[{"delta":{"reasoning_content":"first"}}]}',
        '',
        'data: {"choices":[{"delta":{"content":"visible"}}]}',
        '',
        'data: {"choices":[{"delta":{"reasoning_content":"second"}}]}',
        '',
        'data: {"choices":[{"delta":{"content":" answer"}}]}',
        '',
        'data: [DONE]',
        '',
      ]),
      (chunk) => chunks.push(chunk),
      {
        onAssistantTranscriptMessage: (message) => transcriptMessages.push(message),
      },
    );

    expect(result).toBe('<think>first</think>visible<think>second</think> answer');
    expect(chunks[chunks.length - 1]).toBe('<think>first</think>visible<think>second</think> answer');
    expect(transcriptMessages).toEqual([{
      role: 'assistant',
      content: 'visible answer',
      reasoning_content: 'firstsecond',
    }]);
  });

  it('cancels the stream reader when a stream error payload is received', async () => {
    const cancel = vi.fn();
    const encoder = new TextEncoder();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"error":{"message":"boom"}}\n'));
        },
        cancel,
      }),
    );

    await expect(consumeOpenAIStream(response, () => {})).rejects.toThrow('boom');
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized stream lines before parsing them', async () => {
    const cancel = vi.fn();
    const encoder = new TextEncoder();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('x'.repeat(MAX_OPENAI_STREAM_LINE_CHARS + 1)));
        },
        cancel,
      }),
    );

    await expect(consumeOpenAIStream(response, () => {})).rejects.toThrow('AI stream line is too large');

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });

  it('rejects stream buffers that grow too large before a newline arrives', async () => {
    const cancel = vi.fn();
    const encoder = new TextEncoder();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('x'.repeat(MAX_OPENAI_STREAM_LINE_CHARS)));
          controller.enqueue(encoder.encode('x'));
        },
        cancel,
      }),
    );

    await expect(consumeOpenAIStream(response, () => {})).rejects.toThrow('AI stream line is too large');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });

  it('rejects streams whose accumulated content grows too large', async () => {
    const cancel = vi.fn();
    const chunk = 'x'.repeat(512 * 1024);
    const chunks = Math.ceil(MAX_OPENAI_STREAM_CONTENT_CHARS / chunk.length) + 1;
    const encoder = new TextEncoder();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          for (let index = 0; index < chunks; index += 1) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n`
            ));
          }
        },
        cancel,
      }),
    );

    await expect(consumeOpenAIStream(response, () => {})).rejects.toThrow('AI stream content is too large');

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });

  it('cancels and releases the stream reader when the signal aborts during body reads', async () => {
    const cancel = vi.fn();
    const controller = new AbortController();
    const encoder = new TextEncoder();
    const response = new Response(
      new ReadableStream({
        start(streamController) {
          streamController.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n'));
        },
        cancel,
      }),
    );

    const pending = consumeOpenAIStream(response, () => {}, { signal: controller.signal });
    await vi.waitFor(() => {
      expect(response.body?.locked).toBe(true);
    });

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });

  it('normalizes non-abort reader failures after signal cancellation', async () => {
    const cancel = vi.fn();
    const controller = new AbortController();
    const response = new Response(
      new ReadableStream({
        async pull() {
          controller.abort();
          throw new TypeError('reader closed by runtime');
        },
        cancel,
      }),
    );

    await expect(consumeOpenAIStream(response, () => {}, {
      signal: controller.signal,
    })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });

  it('rejects promptly when the stream reader read and cancel both ignore abort', async () => {
    const controller = new AbortController();
    const fakeReader = {
      read: vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>(() => undefined)),
      cancel: vi.fn(() => new Promise<void>(() => undefined)),
      releaseLock: vi.fn(),
    };
    const response = {
      body: {
        getReader: () => fakeReader,
      },
    } as unknown as Response;

    const pending = consumeOpenAIStream(response, () => {}, { signal: controller.signal });
    await Promise.resolve();

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(fakeReader.cancel).toHaveBeenCalled();
    expect(fakeReader.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('does not finalize a residual stream buffer after a chunk callback aborts', async () => {
    const controller = new AbortController();
    const transcriptMessages: unknown[] = [];

    await expect(consumeOpenAIStream(
      streamResponse([
        'data: {"choices":[{"delta":{"reasoning_content":"stale reasoning"}}]}',
      ]),
      () => controller.abort(),
      {
        signal: controller.signal,
        onAssistantTranscriptMessage: (message) => transcriptMessages.push(message),
      },
    )).rejects.toMatchObject({ name: 'AbortError' });

    expect(transcriptMessages).toEqual([]);
  });

  it('does not return success after a transcript callback aborts', async () => {
    const controller = new AbortController();
    const chunks: string[] = [];

    await expect(consumeOpenAIStream(
      streamResponse([
        'data: {"choices":[{"delta":{"reasoning_content":"plan"}}]}',
        '',
        'data: {"choices":[{"delta":{"content":"answer"}}]}',
        '',
      ]),
      (chunk) => chunks.push(chunk),
      {
        signal: controller.signal,
        onAssistantTranscriptMessage: () => controller.abort(),
      },
    )).rejects.toMatchObject({ name: 'AbortError' });

    expect(chunks[chunks.length - 1]).toBe('<think>plan</think>answer');
  });

  it('parses common OpenAI-compatible non-delta text shapes', async () => {
    const chunks: string[] = [];
    const result = await consumeOpenAIStream(
      streamResponse([
        'data: {"choices":[{"message":{"content":[{"type":"text","text":"choice "}]}}]}',
        'data: {"output_text":"top "}',
        'data: {"output":{"content":{"text":{"value":"nested "}}}}',
        'data: {"data":{"text":"data"}}',
        'data: [DONE]',
        '',
      ]),
      (chunk) => chunks.push(chunk),
    );

    expect(result).toBe('choice top nested data');
    expect(chunks[chunks.length - 1]).toBe('choice top nested data');
  });

  it('maps stream error payloads with their provider code when configured', async () => {
    try {
      await consumeOpenAIStream(
        streamResponse([
          'data: {"error":{"message":"raw quota","code":"points_exhausted"}}',
          '',
        ]),
        () => {},
        {
          mapErrorPayload: (message, code) => {
            const mapped = new Error(`${code}:${message}`) as Error & { errorCode?: string };
            mapped.errorCode = code;
            return mapped;
          },
        },
      );
      throw new Error('Expected stream error');
    } catch (caught) {
      const error = caught as Error & { errorCode?: string };
      expect(error.message).toBe('points_exhausted:raw quota');
      expect(error.errorCode).toBe('points_exhausted');
    }
  });
});

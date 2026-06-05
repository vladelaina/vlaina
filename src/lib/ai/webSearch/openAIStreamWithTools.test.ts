import { beforeEach, describe, expect, it, vi } from 'vitest';

const streamingMocks = vi.hoisted(() => ({
  finishHook: null as null | (() => void),
}));

vi.mock('@/lib/ai/streaming', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/streaming')>();
  return {
    ...actual,
    createStreamAccumulator: (onChunk: (chunk: string) => void) => {
      const accumulator = actual.createStreamAccumulator(onChunk);
      return {
        ...accumulator,
        finish: () => {
          streamingMocks.finishHook?.();
          return accumulator.finish();
        },
      };
    },
  };
});

import { consumeOpenAIStreamWithTools } from './openAIStreamWithTools';
import {
  MAX_OPENAI_STREAM_CONTENT_CHARS,
  MAX_OPENAI_STREAM_LINE_CHARS,
} from '@/lib/ai/streaming';
import {
  MAX_OPENAI_TOOL_ARGUMENT_CHARS,
  MAX_OPENAI_TOOL_CALLS,
} from './openAIToolParsing';

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

describe('consumeOpenAIStreamWithTools', () => {
  beforeEach(() => {
    streamingMocks.finishHook = null;
  });

  it('accumulates streamed content and tool call argument chunks', async () => {
    const chunks: string[] = [];

    const result = await consumeOpenAIStreamWithTools(
      streamResponse([
        'data: {"choices":[{"delta":{"content":"Checking "}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","type":"function","function":{"name":"web_search","arguments":"{\\"query\\":"}}]}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"vlaina\\"}"}}]}}]}',
        'data: {"choices":[{"delta":{"content":"done"}}]}',
        'data: [DONE]',
        '',
      ]),
      (chunk) => chunks.push(chunk),
    );

    expect(result.content).toBe('Checking done');
    expect(result.assistantContent).toBe('Checking done');
    expect(result.toolCalls).toEqual([{
      id: 'call-1',
      type: 'function',
      function: {
        name: 'web_search',
        arguments: '{"query":"vlaina"}',
      },
    }]);
    expect(chunks[chunks.length - 1]).toBe('Checking done');
  });

  it('merges streamed tool call chunks that omit index but keep the same id', async () => {
    const result = await consumeOpenAIStreamWithTools(
      streamResponse([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","type":"function","function":{"name":"web_search","arguments":"{\\"query\\":"}}]}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"id":"call-1","function":{"arguments":"\\"vlaina"}}]}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"function":{"arguments":" ai\\"}"}}]}}]}',
        'data: [DONE]',
        '',
      ]),
      () => {},
    );

    expect(result.toolCalls).toEqual([{
      id: 'call-1',
      type: 'function',
      function: {
        name: 'web_search',
        arguments: '{"query":"vlaina ai"}',
      },
    }]);
  });

  it('merges a later tool call id into an earlier unindexed function delta', async () => {
    const result = await consumeOpenAIStreamWithTools(
      streamResponse([
        'data: {"choices":[{"delta":{"tool_calls":[{"function":{"name":"web_search","arguments":"{\\"query\\":"}}]}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"id":"call-late","type":"function","function":{"name":"web_search","arguments":"\\"late id\\"}"}}]}}]}',
        'data: [DONE]',
        '',
      ]),
      () => {},
    );

    expect(result.toolCalls).toEqual([{
      id: 'call-late',
      type: 'function',
      function: {
        name: 'web_search',
        arguments: '{"query":"late id"}',
      },
    }]);
  });

  it('bounds streamed tool call indexes, counts, and argument text', async () => {
    const toolCalls = Array.from({ length: MAX_OPENAI_TOOL_CALLS + 4 }, (_, index) => ({
      index: index === 0 ? 1_000_000 : index,
      id: `call-${index}`,
      type: 'function',
      function: {
        name: 'web_search',
        arguments: index === 0
          ? 'x'.repeat(MAX_OPENAI_TOOL_ARGUMENT_CHARS + 500)
          : '{"query":"bounded"}',
      },
    }));

    const result = await consumeOpenAIStreamWithTools(
      streamResponse([
        `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: toolCalls } }] })}`,
        'data: [DONE]',
        '',
      ]),
      () => {},
    );

    expect(result.toolCalls).toHaveLength(MAX_OPENAI_TOOL_CALLS);
    expect(result.toolCalls[0].id).toBe('call-0');
    expect(result.toolCalls[0].function.arguments).toHaveLength(MAX_OPENAI_TOOL_ARGUMENT_CHARS);
    expect(result.toolCalls.some((call) => call.id === `call-${MAX_OPENAI_TOOL_CALLS + 1}`)).toBe(false);
  });

  it('cancels and releases the stream reader when a stream error payload is received', async () => {
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

    await expect(consumeOpenAIStreamWithTools(response, () => {})).rejects.toThrow('boom');

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });

  it('rejects oversized tool stream lines before parsing them', async () => {
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

    await expect(consumeOpenAIStreamWithTools(response, () => {})).rejects.toThrow('AI stream line is too large');

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });

  it('rejects tool stream buffers that grow too large before a newline arrives', async () => {
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

    await expect(consumeOpenAIStreamWithTools(response, () => {})).rejects.toThrow('AI stream line is too large');

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });

  it('rejects tool streams whose accumulated assistant content grows too large', async () => {
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

    await expect(consumeOpenAIStreamWithTools(response, () => {})).rejects.toThrow('AI stream content is too large');

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

    const pending = consumeOpenAIStreamWithTools(response, () => {}, { signal: controller.signal });
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

    await expect(consumeOpenAIStreamWithTools(response, () => {}, {
      signal: controller.signal,
    })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });

  it('rejects promptly when the tool stream reader read and cancel both ignore abort', async () => {
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

    const pending = consumeOpenAIStreamWithTools(response, () => {}, { signal: controller.signal });
    await Promise.resolve();

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(fakeReader.cancel).toHaveBeenCalled();
    expect(fakeReader.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('does not finalize a residual stream buffer after a chunk callback aborts', async () => {
    const controller = new AbortController();

    await expect(consumeOpenAIStreamWithTools(
      streamResponse([
        'data: {"choices":[{"delta":{"content":"stale final"}}]}',
      ]),
      () => controller.abort(),
      { signal: controller.signal },
    )).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not return a stream result when cancellation happens during finalization', async () => {
    const controller = new AbortController();
    streamingMocks.finishHook = () => controller.abort();

    await expect(consumeOpenAIStreamWithTools(
      streamResponse([
        'data: {"choices":[{"delta":{"content":"late final"}}]}',
        'data: [DONE]',
        '',
      ]),
      () => {},
      { signal: controller.signal },
    )).rejects.toMatchObject({ name: 'AbortError' });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { consumeOpenAIStream } from './streaming';

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

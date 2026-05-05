import { describe, expect, it } from 'vitest';
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
    );

    expect(result).toBe('<think>\nGot it</think>pong');
    expect(chunks).toContain('<think>\nGot it');
    expect(chunks[chunks.length - 1]).toBe('<think>\nGot it</think>pong');
  });
});

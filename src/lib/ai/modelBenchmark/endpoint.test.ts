import { describe, expect, it } from 'vitest';
import { inferBenchmarkEndpoint } from './endpoint';

describe('inferBenchmarkEndpoint', () => {
  it('detects embedding-style model ids', () => {
    expect(inferBenchmarkEndpoint('text-embedding-3-large')).toBe('embeddings');
    expect(inferBenchmarkEndpoint('bge-large-zh')).toBe('embeddings');
  });

  it('detects image-style model ids', () => {
    expect(inferBenchmarkEndpoint('dall-e-3')).toBe('image');
    expect(inferBenchmarkEndpoint('flux-1-schnell')).toBe('image');
  });

  it('detects responses-only model ids', () => {
    expect(inferBenchmarkEndpoint('codex-mini-latest')).toBe('responses');
  });

  it('falls back to chat for normal chat model ids', () => {
    expect(inferBenchmarkEndpoint('gpt-4o-mini')).toBe('chat');
  });
});

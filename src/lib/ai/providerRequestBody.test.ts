import { describe, expect, it, vi } from 'vitest';
import { stringifyProviderJsonRequestBody } from './providerRequestBody';

describe('providerRequestBody', () => {
  it('stringifies JSON request bodies within the configured budget', () => {
    expect(stringifyProviderJsonRequestBody({ model: 'demo', messages: [] }, 128)).toBe(
      '{"model":"demo","messages":[]}',
    );
  });

  it('rejects oversized JSON request bodies before serializing them', () => {
    const stringifySpy = vi.spyOn(JSON, 'stringify');

    try {
      expect(() =>
        stringifyProviderJsonRequestBody({
          messages: [{ role: 'user', content: 'x'.repeat(256) }],
        }, 64),
      ).toThrow('AI provider request body is too large.');
      expect(stringifySpy).not.toHaveBeenCalled();
    } finally {
      stringifySpy.mockRestore();
    }
  });
});

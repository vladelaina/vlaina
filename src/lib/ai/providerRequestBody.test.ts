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

  it('rejects custom toJSON request bodies before serializing them', () => {
    const stringifySpy = vi.spyOn(JSON, 'stringify');
    const value = {
      model: 'demo',
      toJSON: vi.fn(() => ({
        model: 'demo',
        messages: [{ role: 'user', content: 'x'.repeat(256) }],
      })),
    };

    try {
      expect(() => stringifyProviderJsonRequestBody(value, 128))
        .toThrow('AI provider request body is too large.');
      expect(value.toJSON).not.toHaveBeenCalled();
      expect(stringifySpy).not.toHaveBeenCalled();
    } finally {
      stringifySpy.mockRestore();
    }
  });

  it('rejects toJSON accessors without invoking them', () => {
    const stringifySpy = vi.spyOn(JSON, 'stringify');
    const toJSONGetter = vi.fn(() => () => ({
      messages: [{ role: 'user', content: 'x'.repeat(256) }],
    }));
    const value = { model: 'demo' };
    Object.defineProperty(value, 'toJSON', {
      configurable: true,
      get: toJSONGetter,
    });

    try {
      expect(() => stringifyProviderJsonRequestBody(value, 128))
        .toThrow('AI provider request body is too large.');
      expect(toJSONGetter).not.toHaveBeenCalled();
      expect(stringifySpy).not.toHaveBeenCalled();
    } finally {
      stringifySpy.mockRestore();
    }
  });

  it('rejects enumerable accessors without invoking them', () => {
    const stringifySpy = vi.spyOn(JSON, 'stringify');
    const messagesGetter = vi.fn(() => [{ role: 'user', content: 'hello' }]);
    const value = { model: 'demo' };
    Object.defineProperty(value, 'messages', {
      configurable: true,
      enumerable: true,
      get: messagesGetter,
    });

    try {
      expect(() => stringifyProviderJsonRequestBody(value, 128))
        .toThrow('AI provider request body is too large.');
      expect(messagesGetter).not.toHaveBeenCalled();
      expect(stringifySpy).not.toHaveBeenCalled();
    } finally {
      stringifySpy.mockRestore();
    }
  });

  it('rejects array element accessors without invoking them', () => {
    const stringifySpy = vi.spyOn(JSON, 'stringify');
    const elementGetter = vi.fn(() => ({ role: 'user', content: 'hello' }));
    const messages: unknown[] = [];
    Object.defineProperty(messages, '0', {
      configurable: true,
      enumerable: true,
      get: elementGetter,
    });

    try {
      expect(() => stringifyProviderJsonRequestBody({ model: 'demo', messages }, 128))
        .toThrow('AI provider request body is too large.');
      expect(elementGetter).not.toHaveBeenCalled();
      expect(stringifySpy).not.toHaveBeenCalled();
    } finally {
      stringifySpy.mockRestore();
    }
  });

  it('rejects oversized sparse arrays before serializing them', () => {
    const stringifySpy = vi.spyOn(JSON, 'stringify');

    try {
      expect(() =>
        stringifyProviderJsonRequestBody({
          model: 'demo',
          messages: new Array(100_001),
        }, 1024 * 1024),
      ).toThrow('AI provider request body is too large.');
      expect(stringifySpy).not.toHaveBeenCalled();
    } finally {
      stringifySpy.mockRestore();
    }
  });
});

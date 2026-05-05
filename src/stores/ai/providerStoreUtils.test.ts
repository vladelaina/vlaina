import { describe, expect, it } from 'vitest';
import type { Provider } from '@/lib/ai/types';
import { areProvidersEqual } from './providerStoreUtils';

function buildProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'provider-1',
    name: 'Provider',
    type: 'newapi',
    apiHost: 'https://api.example.com',
    apiKey: 'sk-test',
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('areProvidersEqual', () => {
  it('compares endpoint type changes', () => {
    expect(
      areProvidersEqual(
        [buildProvider({ endpointType: 'openai' })],
        [buildProvider({ endpointType: 'anthropic' })],
      ),
    ).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { normalizeManagedModelsPayload } from './normalizers';

describe('normalizeManagedModelsPayload', () => {
  it('keeps managed model price tiers from the public catalog', () => {
    const models = normalizeManagedModelsPayload({
      data: [
        {
          id: 'gpt-test',
          display_name: 'GPT Test',
          group: 'OpenAI',
          price_tier: '$$',
          price_score: 0.42,
          is_default: true,
        },
      ],
    });

    expect(models[0]).toMatchObject({
      id: 'vlaina-managed::gpt-test',
      apiModelId: 'gpt-test',
      priceTier: '$$',
      priceScore: 0.42,
      isDefault: true,
    });
  });

  it('ignores invalid price metadata', () => {
    const models = normalizeManagedModelsPayload({
      data: [
        {
          id: 'gpt-test',
          price_tier: '$$$$$$',
          price_score: -1,
        },
      ],
    });

    expect(models[0]?.priceTier).toBeUndefined();
    expect(models[0]?.priceScore).toBeUndefined();
  });
});

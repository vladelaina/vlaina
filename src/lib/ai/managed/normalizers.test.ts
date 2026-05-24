import { describe, expect, it } from 'vitest';

import { normalizeManagedBudgetPayload, normalizeManagedModelsPayload } from './normalizers';

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

describe('normalizeManagedBudgetPayload', () => {
  it('accepts direct camelCase percentage fields', () => {
    expect(normalizeManagedBudgetPayload({
      active: true,
      usedPercent: 25,
      remainingPercent: 75,
      status: 'active',
    })).toEqual({
      active: true,
      usedPercent: 25,
      remainingPercent: 75,
      status: 'active',
    });
  });

  it('accepts nested snake_case percentage fields returned by API payloads', () => {
    expect(normalizeManagedBudgetPayload({
      data: {
        active: 'true',
        used_percent: '25',
        remaining_percent: '75%',
        status: 'normal',
      },
    })).toEqual({
      active: true,
      usedPercent: 25,
      remainingPercent: 75,
      status: 'normal',
    });
  });

  it('computes percentage from point totals when percent fields are absent', () => {
    expect(normalizeManagedBudgetPayload({
      budget: {
        points_remaining: 300,
        monthly_points: 1200,
        status: 'active',
      },
    })).toEqual({
      active: true,
      usedPercent: 75,
      remainingPercent: 25,
      status: 'active',
    });
  });

  it('keeps missing remaining percentage as NaN instead of pretending it is zero', () => {
    const budget = normalizeManagedBudgetPayload({
      active: true,
      status: 'active',
    });

    expect(budget.active).toBe(true);
    expect(budget.usedPercent).toBe(0);
    expect(Number.isNaN(budget.remainingPercent)).toBe(true);
  });
});

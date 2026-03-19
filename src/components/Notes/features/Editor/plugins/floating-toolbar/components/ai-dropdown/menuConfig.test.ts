import { beforeEach, describe, expect, it } from 'vitest';
import { getAiMenuGroups } from './menuConfig';
import { recordAiMenuItemUsage } from './usageRanking';

describe('ai dropdown menu config', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps translate at the bottom and exposes the expanded edit and tone options', () => {
    const groups = getAiMenuGroups();
    const translate = groups.find((group) => group.id === 'translate');

    expect(groups.map((group) => group.id)).toEqual(['actions', 'tone', 'translate']);
    expect(groups.find((group) => group.id === 'actions')?.items.map((item) => item.id)).toContain('clarify');
    expect(groups.find((group) => group.id === 'actions')?.items.map((item) => item.id)).toContain('simplify');
    expect(groups.find((group) => group.id === 'tone')?.items.map((item) => item.id)).toContain('tone-empathetic');
    expect(groups.find((group) => group.id === 'tone')?.items.map((item) => item.id)).toContain('tone-persuasive');
    expect(translate?.items.slice(0, 5).map((item) => item.id)).toEqual([
      'translate-en',
      'translate-zh-hans',
      'translate-zh-hant',
      'translate-ja',
      'translate-ko',
    ]);
  });

  it('reorders action items by usage frequency while preserving the fallback order for ties', () => {
    recordAiMenuItemUsage('actions', 'clarify');
    recordAiMenuItemUsage('actions', 'rewrite');
    recordAiMenuItemUsage('actions', 'clarify');

    const actions = getAiMenuGroups().find((group) => group.id === 'actions');
    expect(actions?.items.slice(0, 4).map((item) => item.id)).toEqual([
      'clarify',
      'rewrite',
      'polish',
      'simplify',
    ]);
  });

  it('reorders tone items by usage frequency without affecting translate ordering', () => {
    recordAiMenuItemUsage('tone', 'tone-empathetic');
    recordAiMenuItemUsage('tone', 'tone-empathetic');
    recordAiMenuItemUsage('tone', 'tone-friendly');
    recordAiMenuItemUsage('translate', 'translate-ja');

    const groups = getAiMenuGroups();
    const tone = groups.find((group) => group.id === 'tone');
    const translate = groups.find((group) => group.id === 'translate');

    expect(tone?.items.slice(0, 3).map((item) => item.id)).toEqual([
      'tone-empathetic',
      'tone-friendly',
      'tone-professional',
    ]);
    expect(translate?.items[0]?.id).toBe('translate-en');
  });
});

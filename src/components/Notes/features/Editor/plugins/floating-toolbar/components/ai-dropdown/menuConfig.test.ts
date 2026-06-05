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
    const sidebar = groups.find((group) => group.id === 'sidebar');

    expect(groups.map((group) => group.id)).toEqual(['actions', 'tone', 'translate', 'sidebar']);
    expect(groups.find((group) => group.id === 'actions')?.items.slice(0, 5).map((item) => item.id)).toEqual([
      'polish',
      'rewrite',
      'fix-grammar',
      'simplify',
      'clarify',
    ]);
    expect(groups.find((group) => group.id === 'tone')?.items.slice(0, 5).map((item) => item.id)).toEqual([
      'tone-context-fit',
      'tone-professional',
      'tone-clear',
      'tone-friendly',
      'tone-casual',
    ]);
    expect(translate?.items.slice(0, 5).map((item) => item.id)).toEqual([
      'translate-en',
      'translate-zh-hans',
      'translate-zh-hant',
      'translate-ja',
      'translate-ko',
    ]);
    expect(sidebar?.items).toEqual([]);
    expect(sidebar?.rootAction).toMatchObject({
      id: 'discuss-in-sidebar',
      label: '引用到聊天',
      icon: 'quote',
      behavior: 'sidebar-chat',
      shortcut: 'Ctrl+L',
    });
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
      'fix-grammar',
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
      'tone-context-fit',
    ]);
    expect(translate?.items[0]?.id).toBe('translate-en');
  });

  it('ignores oversized persisted usage payloads', () => {
    localStorage.setItem(
      'vlaina_editor_ai_menu_usage',
      JSON.stringify({ actions: { clarify: 100 } }) + 'x'.repeat(16 * 1024),
    );

    const actions = getAiMenuGroups().find((group) => group.id === 'actions');
    expect(actions?.items.slice(0, 3).map((item) => item.id)).toEqual([
      'polish',
      'rewrite',
      'fix-grammar',
    ]);
  });

  it('normalizes persisted usage to known menu items', () => {
    localStorage.setItem('vlaina_editor_ai_menu_usage', JSON.stringify({
      actions: {
        clarify: 2.8,
        unknown: 100,
        polish: Number.POSITIVE_INFINITY,
      },
      translate: {
        'translate-ja': 100,
      },
    }));

    recordAiMenuItemUsage('actions', 'rewrite');
    recordAiMenuItemUsage('unknown', 'clarify');
    recordAiMenuItemUsage('actions', 'unknown');

    const actions = getAiMenuGroups().find((group) => group.id === 'actions');
    expect(actions?.items.slice(0, 3).map((item) => item.id)).toEqual([
      'clarify',
      'rewrite',
      'polish',
    ]);
    expect(JSON.parse(String(localStorage.getItem('vlaina_editor_ai_menu_usage')))).toEqual({
      actions: {
        clarify: 2,
        rewrite: 1,
      },
    });
  });
});

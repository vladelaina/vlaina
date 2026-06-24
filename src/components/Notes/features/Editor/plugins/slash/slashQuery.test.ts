import { describe, expect, it } from 'vitest';
import { slashCommandDefinitions } from './slashCommandDefinitions';
import { slashMenuItems } from './slashItems';
import { filterSlashItems } from './slashQuery';

describe('slashMenuItems', () => {
  it('is derived from the command definitions', () => {
    expect(slashMenuItems).toHaveLength(slashCommandDefinitions.length);
    expect(new Set(slashMenuItems.map((item) => item.commandId))).toEqual(
      new Set(slashCommandDefinitions.map((definition) => definition.commandId))
    );
  });

  it('starts with the most commonly used commands', () => {
    expect(slashMenuItems.slice(0, 6).map((item) => item.name)).toEqual([
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Task List',
      'Bullet List',
      'Numbered List',
    ]);
  });
});

describe('filterSlashItems', () => {
  it('returns all items for an empty query in common-usage order', () => {
    const names = filterSlashItems('').map((item) => item.name);

    expect(names).toHaveLength(slashMenuItems.length);
    expect(names.slice(0, 6)).toEqual([
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Task List',
      'Bullet List',
      'Numbered List',
    ]);
  });

  it('matches names and search terms case-insensitively', () => {
    expect(filterSlashItems('todo').map((item) => item.name)).toContain('Task List');
    expect(filterSlashItems('H1').map((item) => item.name)).toContain('Heading 1');
    expect(filterSlashItems('h').map((item) => item.name)).toContain('Heading 1');
  });

  it('matches command names from any app locale', () => {
    expect(filterSlashItems('表格').map((item) => item.name)).toContain('Table');
    expect(filterSlashItems('目录').map((item) => item.name)).toContain('Table of Contents');
    expect(filterSlashItems('cita').map((item) => item.name)).toContain('Quote');
    expect(filterSlashItems('citacao').map((item) => item.name)).toContain('Quote');
  });

  it('matches common localized aliases and pinyin', () => {
    expect(filterSlashItems('biaoti').map((item) => item.name)).toContain('Heading 1');
    expect(filterSlashItems('gongshi').map((item) => item.name)).toContain('Equation');
    expect(filterSlashItems('tupian').map((item) => item.name)).toContain('Image');
    expect(filterSlashItems('biaoqing').map((item) => item.name)).toContain('Emoji');
  });

  it('matches common habits across supported languages', () => {
    expect(filterSlashItems('tabelle').map((item) => item.name)).toContain('Table');
    expect(filterSlashItems('aufgabe').map((item) => item.name)).toContain('Task List');
    expect(filterSlashItems('muc luc').map((item) => item.name)).toContain('Table of Contents');
    expect(filterSlashItems('dipnot').map((item) => item.name)).toContain('Footnote');
    expect(filterSlashItems('動画').map((item) => item.name)).toContain('Video');
  });

  it('matches compact abbreviations for common commands', () => {
    expect(filterSlashItems('td')[0]?.name).toBe('Task List');
    expect(filterSlashItems('cb')[0]?.name).toBe('Code Block');
    expect(filterSlashItems('fm')[0]?.name).toBe('Frontmatter');
  });

  it('matches common misspellings for discoverability', () => {
    expect(filterSlashItems('vedio')[0]?.name).toBe('Video');
  });

  it('keeps HTML block as the direct /html match', () => {
    expect(filterSlashItems('html')[0]?.commandId).toBe('html-block');
  });

  it('matches short typo queries against compact search terms', () => {
    expect(filterSlashItems('j3')[0]?.name).toBe('Heading 3');
  });

  it('matches noisy queries that keep a numeric command alias suffix', () => {
    expect(filterSlashItems('ssssss3')[0]?.name).toBe('Heading 3');
  });

  it('does not match pure numeric noise as a heading alias typo', () => {
    expect(filterSlashItems('2023')).toEqual([]);
  });

  it('does not make single-character typo queries overly broad', () => {
    expect(filterSlashItems('j')).toEqual([]);
  });

  it('keeps stronger matches before fuzzy subsequence matches', () => {
    const names = filterSlashItems('im').map((item) => item.name);

    expect(names.indexOf('Image')).toBeLessThan(names.indexOf('Inline Math'));
  });

  it('finds the emoji picker command', () => {
    expect(filterSlashItems('e')[0]?.commandId).toBe('emoji');
    expect(filterSlashItems('emoji')[0]?.commandId).toBe('emoji');
    expect(filterSlashItems('表情').map((item) => item.commandId)).toContain('emoji');
  });

  it('matches localized emoji aliases across supported languages', () => {
    const aliases = [
      '表情符號',
      '絵文字',
      '이모티콘',
      'émoticône',
      'gesicht',
      'emoticón',
      'reação',
      'faccina',
      'эмодзи',
      'gülen yüz',
      'biểu tượng cảm xúc',
      'emotikon',
      'อีโมจิ',
    ];

    for (const alias of aliases) {
      expect(filterSlashItems(alias).map((item) => item.commandId), alias).toContain('emoji');
    }
  });

  it('uses common-usage order when search scores tie', () => {
    const names = filterSlashItems('heading').map((item) => item.name);

    expect(names.slice(0, 6)).toEqual([
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Heading 4',
      'Heading 5',
      'Heading 6',
    ]);
  });

  it('keeps frontmatter behind other short metadata-like matches', () => {
    const names = filterSlashItems('me').map((item) => item.name);

    expect(names[0]).toBe('Mermaid Diagram');
    expect(names.at(-1)).toBe('Frontmatter');
  });
});

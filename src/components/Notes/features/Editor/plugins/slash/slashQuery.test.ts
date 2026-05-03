import { describe, expect, it } from 'vitest';
import { slashCommandDefinitions } from './slashCommandDefinitions';
import { slashMenuItems } from './slashItems';
import { filterSlashItems } from './slashQuery';

describe('slashMenuItems', () => {
  it('is derived from the command definitions', () => {
    expect(slashMenuItems).toHaveLength(slashCommandDefinitions.length);
    expect(slashMenuItems.map((item) => item.commandId)).toEqual(
      slashCommandDefinitions.map((definition) => definition.commandId)
    );
  });
});

describe('filterSlashItems', () => {
  it('returns all items for an empty query', () => {
    expect(filterSlashItems('')).toHaveLength(slashMenuItems.length);
  });

  it('matches names and search terms case-insensitively', () => {
    expect(filterSlashItems('todo').map((item) => item.name)).toContain('Task List');
    expect(filterSlashItems('H1').map((item) => item.name)).toContain('Heading 1');
  });

  it('matches compact abbreviations for common commands', () => {
    expect(filterSlashItems('td')[0]?.name).toBe('Task List');
    expect(filterSlashItems('cb')[0]?.name).toBe('Code Block');
    expect(filterSlashItems('fm')[0]?.name).toBe('Frontmatter');
  });

  it('keeps stronger matches before fuzzy subsequence matches', () => {
    const names = filterSlashItems('im').map((item) => item.name);

    expect(names.indexOf('Image')).toBeLessThan(names.indexOf('Inline Math'));
  });
});

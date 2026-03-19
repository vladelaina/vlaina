import { describe, expect, it } from 'vitest';
import { slashMenuItems } from './slashItems';
import { filterSlashItems, groupSlashItems } from './slashQuery';

describe('filterSlashItems', () => {
  it('returns all items for an empty query', () => {
    expect(filterSlashItems('')).toHaveLength(slashMenuItems.length);
  });

  it('matches names and search terms case-insensitively', () => {
    expect(filterSlashItems('todo').map((item) => item.name)).toContain('Task List');
    expect(filterSlashItems('H1').map((item) => item.name)).toContain('Heading 1');
  });
});

describe('groupSlashItems', () => {
  it('keeps group declaration order', () => {
    const groups = groupSlashItems(filterSlashItems(''));

    expect(Array.from(groups.keys())).toEqual(['Basic', 'Lists', 'Media', 'Advanced']);
    expect(groups.get('Basic')?.[0]?.name).toBe('Text');
  });
});

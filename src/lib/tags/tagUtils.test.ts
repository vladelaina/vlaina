import { describe, expect, it } from 'vitest';
import type { NekoEvent } from '@/lib/ics/types';
import {
  normalizeTag,
  normalizeTags,
  serializeTags,
  deserializeTags,
  hasTag,
  taskHasTag,
  matchesSelectedTag,
  matchesSelectedTagForProgressItem,
  SYSTEM_TAG_WEEK,
  SYSTEM_TAG_TODAY,
  collectUniqueTags,
  countTasksByTag,
} from './tagUtils';

function createTask(overrides: Partial<NekoEvent> = {}): NekoEvent {
  return {
    uid: 'task-1',
    summary: 'Task',
    dtstart: new Date('2026-03-04T08:00:00.000Z'),
    dtend: new Date('2026-03-04T08:30:00.000Z'),
    allDay: false,
    calendarId: 'main',
    ...overrides,
  };
}

describe('tagUtils', () => {
  it('normalizes spacing for a single tag', () => {
    expect(normalizeTag('  Deep   Work  ')).toBe('Deep Work');
  });

  it('normalizes and deduplicates tags case-insensitively', () => {
    expect(normalizeTags([' Work ', 'work', 'Learning', 'learning '])).toEqual(['Work', 'Learning']);
  });

  it('serializes and deserializes tags round-trip', () => {
    const serialized = serializeTags(['Work', 'Learning']);
    expect(serialized).toBeTruthy();
    expect(deserializeTags(serialized)).toEqual(['Work', 'Learning']);
  });

  it('checks if a task has a specific tag and matches selected filter', () => {
    const task = createTask({ tags: ['Learning', 'Work'] });
    expect(hasTag(['Learning', 'Work'], 'learning')).toBe(true);
    expect(taskHasTag(task, 'work')).toBe(true);
    expect(taskHasTag(task, 'Personal')).toBe(false);
    expect(matchesSelectedTag(task, 'Learning')).toBe(true);
    expect(matchesSelectedTag(task, null)).toBe(true);
  });

  it('matches today system label by date instead of manual tags', () => {
    const todayTask = createTask({
      uid: 'today',
      dtstart: new Date(),
      tags: ['Today'],
    });
    const oldTask = createTask({
      uid: 'old',
      dtstart: new Date('2000-01-01T00:00:00.000Z'),
      tags: ['Today'],
    });

    expect(matchesSelectedTag(todayTask, SYSTEM_TAG_TODAY)).toBe(true);
    expect(matchesSelectedTag(oldTask, SYSTEM_TAG_TODAY)).toBe(false);
  });

  it('matches week system label by current week range', () => {
    const thisWeekTask = createTask({
      uid: 'this-week',
      dtstart: new Date(),
    });
    const oldTask = createTask({
      uid: 'old-week',
      dtstart: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });

    expect(matchesSelectedTag(thisWeekTask, SYSTEM_TAG_WEEK)).toBe(true);
    expect(matchesSelectedTag(oldTask, SYSTEM_TAG_WEEK)).toBe(false);
  });

  it('collects unique tags and counts tasks by tag', () => {
    const tasks: NekoEvent[] = [
      createTask({ uid: '1', tags: ['Work', 'Learning'] }),
      createTask({ uid: '2', tags: ['work'] }),
      createTask({ uid: '3', tags: ['Personal'] }),
    ];

    expect(collectUniqueTags(tasks)).toEqual(['Learning', 'Personal', 'Work']);
    expect(countTasksByTag(tasks, 'work')).toBe(2);
  });

  it('matches progress items by normal tag', () => {
    expect(
      matchesSelectedTagForProgressItem(
        {
          tags: ['Fitness', 'Health'],
          lastUpdateDate: '2026-03-04',
        },
        'fitness'
      )
    ).toBe(true);
  });

  it('matches progress items by Today system label', () => {
    const todayKey = new Date();
    const yyyy = todayKey.getFullYear();
    const mm = String(todayKey.getMonth() + 1).padStart(2, '0');
    const dd = String(todayKey.getDate()).padStart(2, '0');
    const formatted = `${yyyy}-${mm}-${dd}`;

    expect(
      matchesSelectedTagForProgressItem(
        {
          tags: ['Work'],
          lastUpdateDate: formatted,
        },
        SYSTEM_TAG_TODAY
      )
    ).toBe(true);

    expect(
      matchesSelectedTagForProgressItem(
        {
          tags: ['Work'],
          lastUpdateDate: '2000-01-01',
        },
        SYSTEM_TAG_TODAY
      )
    ).toBe(false);
  });

  it('matches progress items by Week system label', () => {
    const now = new Date();
    const thisWeekKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const oldDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oldWeekKey = `${oldDate.getFullYear()}-${String(oldDate.getMonth() + 1).padStart(2, '0')}-${String(oldDate.getDate()).padStart(2, '0')}`;

    expect(
      matchesSelectedTagForProgressItem(
        {
          history: {
            [thisWeekKey]: 2,
          },
        },
        SYSTEM_TAG_WEEK
      )
    ).toBe(true);

    expect(
      matchesSelectedTagForProgressItem(
        {
          history: {
            [oldWeekKey]: 5,
          },
        },
        SYSTEM_TAG_WEEK
      )
    ).toBe(false);
  });
});

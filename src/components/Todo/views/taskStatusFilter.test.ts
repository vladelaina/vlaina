import { describe, it, expect } from 'vitest';
import type { NekoEvent } from '@/lib/ics/types';
import { matchesSelectedStatus } from './taskStatusFilter';

function makeTask(overrides: Partial<NekoEvent> = {}): NekoEvent {
  return {
    uid: 'task-1',
    summary: 'Task',
    dtstart: new Date('2026-03-03T09:00:00.000Z'),
    dtend: new Date('2026-03-03T09:30:00.000Z'),
    allDay: false,
    calendarId: 'main',
    completed: false,
    ...overrides,
  };
}

describe('matchesSelectedStatus', () => {
  it('matches completed tasks only when completed status is selected', () => {
    const completedTask = makeTask({ completed: true });

    expect(matchesSelectedStatus(completedTask, ['completed'])).toBe(true);
    expect(matchesSelectedStatus(completedTask, ['todo', 'scheduled'])).toBe(false);
  });

  it('matches scheduled tasks when scheduled status is selected', () => {
    const scheduledTask = makeTask({ completed: false });

    expect(matchesSelectedStatus(scheduledTask, ['scheduled'])).toBe(true);
    expect(matchesSelectedStatus(scheduledTask, ['todo'])).toBe(false);
  });

  it('matches unscheduled tasks when todo status is selected', () => {
    const unscheduledTask = makeTask({
      dtstart: undefined as unknown as Date,
      completed: false,
    });

    expect(matchesSelectedStatus(unscheduledTask, ['todo'])).toBe(true);
    expect(matchesSelectedStatus(unscheduledTask, ['scheduled'])).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { ChatSession } from '@/lib/ai/types';
import {
  filterChatSidebarSessions,
  getVisibleChatSidebarSessions,
  sortChatSidebarSessions,
} from './chatSidebarSearch';

const sessions: ChatSession[] = [
  {
    id: 'session-a',
    title: 'Alpha',
    modelId: 'model',
    updatedAt: 10,
    createdAt: 1,
  },
  {
    id: 'session-b',
    title: 'Beta Project',
    modelId: 'model',
    updatedAt: 30,
    createdAt: 2,
  },
  {
    id: 'session-c',
    title: 'Pinned',
    modelId: 'model',
    isPinned: true,
    updatedAt: 5,
    createdAt: 3,
  },
];

describe('chatSidebarSearch', () => {
  it('keeps pinned sessions ahead of recent ones', () => {
    const sorted = sortChatSidebarSessions(sessions);

    expect(sorted.map((session) => session.id)).toEqual([
      'session-c',
      'session-b',
      'session-a',
    ]);
  });

  it('filters sessions by title', () => {
    const sorted = sortChatSidebarSessions(sessions);
    const filtered = filterChatSidebarSessions(sorted, 'pro');

    expect(filtered.map((session) => session.id)).toEqual(['session-b']);
  });

  it('filters out temporary sessions before sorting', () => {
    const visible = getVisibleChatSidebarSessions([
      ...sessions,
      {
        id: 'temp-session-1',
        title: 'Temporary',
        modelId: 'model',
        updatedAt: 40,
        createdAt: 4,
      },
    ]);

    expect(visible.map((session) => session.id)).not.toContain('temp-session-1');
  });
});

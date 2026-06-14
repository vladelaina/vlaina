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

  it('bounds the sidebar search query before matching', () => {
    const filtered = filterChatSidebarSessions(sessions, `${'x'.repeat(256)}alpha`);

    expect(filtered).toEqual([]);
  });

  it('bounds oversized raw search queries before trimming', () => {
    const filtered = filterChatSidebarSessions(sessions, `${' '.repeat(4096)}alpha`);

    expect(filtered).toEqual([]);
  });

  it('bounds session title text used for sidebar search entries', () => {
    const filtered = filterChatSidebarSessions([
      {
        id: 'session-long',
        title: `${'x'.repeat(4096)}needle`,
        modelId: 'model',
        updatedAt: 1,
        createdAt: 1,
      },
    ], 'needle');

    expect(filtered).toEqual([]);
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

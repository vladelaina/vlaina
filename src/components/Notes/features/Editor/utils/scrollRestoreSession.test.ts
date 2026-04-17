import { describe, expect, it, vi } from 'vitest';
import { createScrollRestoreSession } from './scrollRestoreSession';

describe('createScrollRestoreSession', () => {
  it('stops applying scroll restores after the session finishes', () => {
    let scrollTop = 120;
    let activePath: string | null = 'note-a';
    let sessionPath: string | null = 'note-a';
    const onApply = vi.fn();
    const onFinish = vi.fn();
    const onStop = vi.fn();

    const session = createScrollRestoreSession({
      notePath: 'note-a',
      targetScrollTop: 0,
      getActivePath: () => activePath,
      getSessionPath: () => sessionPath,
      readScrollTop: () => scrollTop,
      writeScrollTop: (nextScrollTop) => {
        scrollTop = nextScrollTop;
      },
      onApply,
      onFinish,
      onStop,
    });

    expect(session.restore('sync')).toBe(false);
    expect(scrollTop).toBe(0);
    expect(onApply).toHaveBeenCalledWith('sync');

    expect(session.finish()).toBe(true);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(session.isActive()).toBe(false);

    scrollTop = 240;
    expect(session.restore('snapshot:2')).toBe(false);
    expect(scrollTop).toBe(240);
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('does not restore when the active note or restore session path no longer matches', () => {
    let scrollTop = 80;
    let activePath: string | null = 'note-a';
    let sessionPath: string | null = 'note-a';

    const session = createScrollRestoreSession({
      notePath: 'note-a',
      targetScrollTop: 0,
      getActivePath: () => activePath,
      getSessionPath: () => sessionPath,
      readScrollTop: () => scrollTop,
      writeScrollTop: (nextScrollTop) => {
        scrollTop = nextScrollTop;
      },
      onFinish: vi.fn(),
    });

    activePath = 'note-b';
    expect(session.restore('other-note')).toBe(false);
    expect(scrollTop).toBe(80);

    activePath = 'note-a';
    sessionPath = 'note-b';
    expect(session.restore('stale-session')).toBe(false);
    expect(scrollTop).toBe(80);
  });

  it('treats scroll positions within tolerance as already restored', () => {
    let scrollTop = 0.5;

    const session = createScrollRestoreSession({
      notePath: 'note-a',
      targetScrollTop: 0,
      getActivePath: () => 'note-a',
      getSessionPath: () => 'note-a',
      readScrollTop: () => scrollTop,
      writeScrollTop: vi.fn(),
      onFinish: vi.fn(),
    });

    expect(session.restore('within-tolerance')).toBe(true);
  });
});

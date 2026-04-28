import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAccountSessionStore } from '@/stores/accountSession';
import { initialAccountSessionState } from '@/stores/accountSession/state';
import { useUserAvatar } from './useUserAvatar';

describe('useUserAvatar', () => {
  it('falls back to the remote account avatar while the local cache is missing', () => {
    useAccountSessionStore.setState({
      ...initialAccountSessionState,
      avatarUrl: 'https://lh3.googleusercontent.com/avatar',
      localAvatarUrl: null,
    });

    const { result } = renderHook(() => useUserAvatar());

    expect(result.current).toBe('https://lh3.googleusercontent.com/avatar');
  });

  it('prefers the local cached avatar once available', () => {
    useAccountSessionStore.setState({
      ...initialAccountSessionState,
      avatarUrl: 'https://lh3.googleusercontent.com/avatar',
      localAvatarUrl: 'data:image/png;base64,local',
    });

    const { result } = renderHook(() => useUserAvatar());

    expect(result.current).toBe('data:image/png;base64,local');
  });
});

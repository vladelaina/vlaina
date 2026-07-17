import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from '@/stores/uiSlice';
import { ACCOUNT_USER_PERSIST_KEY } from './state';
import {
  ACCOUNT_USER_BROADCAST_CHANNEL,
  ACCOUNT_USER_BROADCAST_TYPE,
  AUTH_PROVIDER_STORAGE_KEY,
  AUTH_STATE_STORAGE_KEY,
  ACCOUNT_STATUS_REFRESH_KEY,
  broadcastAccountStatusRefresh,
  clearAuthIntent,
  clearPersistedUser,
  loadPersistedUser,
  normalizeAuthError,
  isEmailCodeRequestCooldownError,
  normalizePersistedUser,
  persistUser,
} from './authSupport';

describe('normalizeAuthError', () => {
  it('maps network failures to a user-facing offline message', () => {
    useUIStore.setState({ languagePreference: 'en' });

    expect(normalizeAuthError('Unable to reach vlaina API: Failed to fetch')).toBe(
      '๑ᵒᯅᵒ๑ Network connection error'
    );
    expect(normalizeAuthError('NetworkError when attempting to fetch resource.')).toBe(
      '๑ᵒᯅᵒ๑ Network connection error'
    );
    expect(normalizeAuthError('net::ERR_PROXY_CONNECTION_FAILED')).toBe(
      '๑ᵒᯅᵒ๑ Network connection error'
    );
    expect(normalizeAuthError('net::ERR_NAME_NOT_RESOLVED')).toBe(
      '๑ᵒᯅᵒ๑ Network connection error'
    );
    expect(normalizeAuthError('net::ERR_CERT_AUTHORITY_INVALID')).toBe(
      '๑ᵒᯅᵒ๑ Network connection error'
    );
  });

  it('does not classify secure storage failures as network failures', () => {
    useUIStore.setState({ languagePreference: 'en' });

    expect(normalizeAuthError('System secure storage is unavailable')).toBe(
      '๑ᵒᯅᵒ๑ Unable to save sign-in'
    );
  });

  it('removes Electron IPC noise from email code failures', () => {
    useUIStore.setState({ languagePreference: 'en' });

    expect(
      normalizeAuthError("Error invoking remote method 'desktop:account:verify-email-code': Incorrect verification code")
    ).toBe('๑ᵒᯅᵒ๑ That code is incorrect');
  });

  it('localizes invalid email address failures', () => {
    useUIStore.setState({ languagePreference: 'zh-CN' });

    expect(normalizeAuthError('Invalid email address')).toBe('๑ᵒᯅᵒ๑ 请输入有效的邮箱地址');
    expect(
      normalizeAuthError("Error invoking remote method 'desktop:account:request-email-code': Invalid email address")
    ).toBe('๑ᵒᯅᵒ๑ 请输入有效的邮箱地址');
  });

  it('localizes remaining account sign-in and email request failures', () => {
    useUIStore.setState({ languagePreference: 'zh-CN' });

    expect(normalizeAuthError('You are already signed in with this email')).toBe('๑ᵒᯅᵒ๑ 已使用此邮箱登录');
    expect(normalizeAuthError('Failed to send verification code: HTTP 400')).toBe(
      '๑ᵒᯅᵒ๑ 验证码发送失败，请稍后重试'
    );
    expect(
      normalizeAuthError(
        'Web sign-in is unavailable on local development origins. Use vlaina.com/pricing or the desktop app.'
      )
    ).toBe('๑ᵒᯅᵒ๑ 当前环境不支持网页登录，请使用 vlaina.com 或桌面应用');
    expect(normalizeAuthError('Failed to start account sign-in')).toBe('๑ᵒᯅᵒ๑ 登录失败');
    expect(normalizeAuthError('Account sign-in state mismatch')).toBe('๑ᵒᯅᵒ๑ 登录失败');
    expect(normalizeAuthError('OAuth state mismatch')).toBe('๑ᵒᯅᵒ๑ 登录失败');
  });

  it('localizes email code failures', () => {
    useUIStore.setState({ languagePreference: 'zh-CN' });

    expect(normalizeAuthError('Incorrect verification code')).toBe('๑ᵒᯅᵒ๑ 验证码错误');
    expect(normalizeAuthError('Invalid or expired verification code')).toBe('๑ᵒᯅᵒ๑ 验证码无效或已过期');
    expect(normalizeAuthError('This email is not allowed to register')).toBe('๑ᵒᯅᵒ๑ 此邮箱暂不允许注册');
    expect(normalizeAuthError('Too many verification emails requested. Please try again later.')).toBe(
      '๑ᵒᯅᵒ๑ 获取验证码次数过多，请稍后再试'
    );
    expect(normalizeAuthError('Email sign-in is temporarily unavailable')).toBe(
      '๑ᵒᯅᵒ๑ 登录失败，请稍后重试'
    );
  });

  it('localizes OAuth and sign-out failures', () => {
    useUIStore.setState({ languagePreference: 'zh-CN' });

    expect(normalizeAuthError('OAuth temporarily unavailable')).toBe('๑ᵒᯅᵒ๑ 登录失败');
    expect(normalizeAuthError('Google OAuth temporarily unavailable')).toBe('๑ᵒᯅᵒ๑ 登录失败');
    expect(normalizeAuthError('Desktop OAuth session expired')).toBe('๑ᵒᯅᵒ๑ 登录失败');
    expect(normalizeAuthError('Failed to revoke session: HTTP 500')).toBe('๑ᵒᯅᵒ๑ 退出登录失败，请重试');
  });

  it('does not expose public authentication API errors as raw English', () => {
    useUIStore.setState({ languagePreference: 'zh-CN' });
    const messages = [
      'Invalid email address',
      'Invalid verification code',
      'Invalid or expired verification code',
      'Email sign-in is temporarily unavailable',
      'This email is not allowed to register',
      'Too many verification emails requested. Please try again later.',
      'Missing OAuth state',
      'Invalid OAuth state',
      'OAuth session not found',
      'OAuth session expired',
      'OAuth browser verification failed',
      'OAuth temporarily unavailable',
      'Google OAuth temporarily unavailable',
      'Invalid desktop OAuth state',
      'Invalid desktop verifier',
      'Invalid desktop result token',
      'Invalid desktop callback URL',
      'Desktop OAuth verification failed',
      'Desktop OAuth callback verification failed',
      'Desktop OAuth session not found',
      'Desktop OAuth session expired',
      'Desktop sign-in is temporarily unavailable',
      'Missing session token',
      'Failed to revoke session',
    ];

    for (const message of messages) {
      expect(normalizeAuthError(message), message).not.toBe(message);
    }
  });

  it('detects email code request cooldown errors', () => {
    expect(isEmailCodeRequestCooldownError('Please wait before requesting another verification code.')).toBe(true);
    expect(
      isEmailCodeRequestCooldownError(
        "Error invoking remote method 'desktop:account:request-email-code': error: please wait before requesting another code"
      )
    ).toBe(true);
    expect(isEmailCodeRequestCooldownError('Incorrect verification code')).toBe(false);
  });
});

describe('loadPersistedUser', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('hydrates the last connected account identity for first paint', () => {
    localStorage.setItem(ACCOUNT_USER_PERSIST_KEY, JSON.stringify({
      isConnected: true,
      provider: 'google',
      username: 'Vlad',
      primaryEmail: 'vlad@example.com',
      avatarUrl: 'https://lh3.googleusercontent.com/avatar',
      membershipTier: 'pro',
      membershipName: 'Pro',
    }));

    expect(loadPersistedUser()).toEqual({
      isConnected: true,
      provider: 'google',
      username: 'Vlad',
      primaryEmail: 'vlad@example.com',
      avatarUrl: 'https://lh3.googleusercontent.com/avatar',
      membershipTier: 'pro',
      membershipName: 'Pro',
    });
  });

  it('ignores oversized persisted account identity payloads', () => {
    localStorage.setItem(ACCOUNT_USER_PERSIST_KEY, 'x'.repeat(65 * 1024));

    expect(loadPersistedUser()).toEqual({});
  });

  it('bounds persisted account identity fields before hydrating them', () => {
    localStorage.setItem(ACCOUNT_USER_PERSIST_KEY, JSON.stringify({
      isConnected: true,
      provider: 'google',
      username: 'u'.repeat(257),
      primaryEmail: ' user@example.com ',
      avatarUrl: 'http://127.0.0.1:3000/avatar.png',
      membershipTier: 'pro',
      membershipName: `Pro\u0000Plan`,
    }));

    expect(loadPersistedUser()).toEqual({
      isConnected: true,
      provider: 'google',
      username: null,
      primaryEmail: 'user@example.com',
      avatarUrl: null,
      membershipTier: 'pro',
      membershipName: null,
    });
  });

  it('rejects oversized account identity strings before normalizing them', () => {
    expect(normalizePersistedUser({
      isConnected: true,
      provider: 'google',
      username: 'u'.repeat(1024 * 1024),
      primaryEmail: 'vla@example.com',
      avatarUrl: null,
      membershipTier: 'pro',
      membershipName: 'Pro',
    })).toMatchObject({
      isConnected: true,
      provider: 'google',
      username: null,
      primaryEmail: 'vla@example.com',
      membershipTier: 'pro',
      membershipName: 'Pro',
    });
  });

  it('ignores unavailable localStorage when persisting account identity', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => persistUser({
      isConnected: true,
      provider: 'google',
      username: 'vla',
      primaryEmail: null,
      avatarUrl: null,
      membershipTier: 'free',
      membershipName: 'Free',
    })).not.toThrow();
  });

  it('broadcasts persisted account identity for other windows', () => {
    const postMessage = vi.fn();
    const close = vi.fn();
    const BroadcastChannelMock = vi.fn(function BroadcastChannel(this: { postMessage: typeof postMessage; close: typeof close }, name: string) {
      expect(name).toBe(ACCOUNT_USER_BROADCAST_CHANNEL);
      this.postMessage = postMessage;
      this.close = close;
    });
    vi.stubGlobal('BroadcastChannel', BroadcastChannelMock);

    const identity = {
      isConnected: true,
      provider: 'google' as const,
      username: 'vla',
      primaryEmail: 'vla@example.com',
      avatarUrl: null,
      membershipTier: 'pro' as const,
      membershipName: 'Pro',
    };

    persistUser(identity);

    expect(postMessage).toHaveBeenCalledWith({
      type: ACCOUNT_USER_BROADCAST_TYPE,
      identity,
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('normalizes account identity before persisting or broadcasting it', () => {
    const postMessage = vi.fn();
    const close = vi.fn();
    const BroadcastChannelMock = vi.fn(function BroadcastChannel(this: { postMessage: typeof postMessage; close: typeof close }, name: string) {
      expect(name).toBe(ACCOUNT_USER_BROADCAST_CHANNEL);
      this.postMessage = postMessage;
      this.close = close;
    });
    vi.stubGlobal('BroadcastChannel', BroadcastChannelMock);

    persistUser({
      isConnected: true,
      provider: 'google',
      username: ' vla ',
      primaryEmail: 'vla@example.com',
      avatarUrl: 'http://192.168.1.2/avatar.png',
      membershipTier: 'pro',
      membershipName: 'P'.repeat(129),
    });

    const normalizedIdentity = {
      isConnected: true,
      provider: 'google',
      username: 'vla',
      primaryEmail: 'vla@example.com',
      avatarUrl: null,
      membershipTier: 'pro',
      membershipName: null,
    };
    expect(JSON.parse(localStorage.getItem(ACCOUNT_USER_PERSIST_KEY) || '{}')).toEqual(normalizedIdentity);
    expect(postMessage).toHaveBeenCalledWith({
      type: ACCOUNT_USER_BROADCAST_TYPE,
      identity: normalizedIdentity,
    });
  });

  it('clears persisted account identity when temporary desktop auth is used', () => {
    localStorage.setItem(ACCOUNT_USER_PERSIST_KEY, JSON.stringify({
      isConnected: true,
      provider: 'google',
      username: 'vla',
    }));

    clearPersistedUser();

    expect(localStorage.getItem(ACCOUNT_USER_PERSIST_KEY)).toBeNull();
  });

  it('broadcasts account status refresh without persisting account identity', () => {
    broadcastAccountStatusRefresh();

    expect(localStorage.getItem(ACCOUNT_STATUS_REFRESH_KEY)).toBeNull();
    expect(localStorage.getItem(ACCOUNT_USER_PERSIST_KEY)).toBeNull();
  });

  it('ignores unavailable sessionStorage when clearing auth intent', () => {
    sessionStorage.setItem(AUTH_STATE_STORAGE_KEY, 'state');
    sessionStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, 'google');
    vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => clearAuthIntent()).not.toThrow();
  });
});

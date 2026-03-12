import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/icons';
import { openUrl } from '@tauri-apps/plugin-opener';
import { selectClassName, selectStyle, settingsButtonClassName } from '../styles';
import { useAccountSessionStore } from '@/stores/accountSession';
import { STORAGE_KEY_AUTO_UPDATE } from '@/lib/config';
import { AccountSignInOptions } from '@/components/account/AccountSignInOptions';
import { getAccountProviderLabel, type OauthAccountProvider } from '@/lib/account/provider';

export function AboutTab() {
  const [autoUpdate, setAutoUpdate] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_AUTO_UPDATE);
    return saved !== null ? JSON.parse(saved) : true;
  });

  const {
    isConnected,
    provider,
    username,
    primaryEmail,
    isConnecting,
    isLoading,
    error,
    signIn,
    requestEmailCode,
    verifyEmailCode,
    signOut,
    clearError,
    checkStatus,
  } = useAccountSessionStore();

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const handleConnect = async (nextProvider: OauthAccountProvider) => {
    clearError();
    await signIn(nextProvider);
  };

  const handleDisconnect = async () => {
    await signOut();
  };

  const toggleAutoUpdate = () => {
    const newValue = !autoUpdate;
    setAutoUpdate(newValue);
    localStorage.setItem(STORAGE_KEY_AUTO_UPDATE, JSON.stringify(newValue));
  };

  const openGitHub = async () => {
    await openUrl('https://github.com/NekoTick/NekoTick');
  };

  const openLatestRelease = async () => {
    await openUrl('https://github.com/NekoTick/NekoTick/releases/latest');
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">Account</h2>

        <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <Icon size="md" name="user.profile" className="text-green-500" />
              ) : (
                <Icon size="md" name="user.person" className="text-zinc-400" />
              )}
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {isConnected ? `Signed in via ${getAccountProviderLabel(provider)}` : 'Not signed in'}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isConnected ? username || primaryEmail || 'NekoTick account connected' : 'Sign in unlocks your managed NekoTick AI account.'}
                </div>
              </div>
            </div>

            {isLoading ? (
              <Icon size="md" name="common.refresh" className="animate-spin text-zinc-400" />
            ) : isConnected ? (
              <button
                onClick={handleDisconnect}
                className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                Disconnect
              </button>
            ) : (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Choose a provider below</div>
            )}
          </div>

          {!isConnected ? (
            <AccountSignInOptions
              isConnecting={isConnecting}
              error={error}
              onOauthSignIn={handleConnect}
              onEmailCodeRequest={requestEmailCode}
              onEmailCodeVerify={verifyEmailCode}
            />
          ) : null}
        </div>

        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Local notes stay on your device. Account sign-in unlocks managed AI. GitHub is now an optional provider instead of the required first-run entry gate.
        </p>
      </div>

      <div className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">Open Source Licenses</h2>

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-700/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Material Design Icons</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Apache 2.0</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Google's Material Design Icons are used throughout this application.
            </p>
          </div>
          <div className="bg-zinc-50 px-4 py-3 dark:bg-zinc-900/50">
            <p className="font-mono text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              Licensed under the Apache License, Version 2.0 (the "License");
              you may not use this file except in compliance with the License.
              You may obtain a copy of the License at
              http://www.apache.org/licenses/LICENSE-2.0
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">App</h2>
      </div>

      <div className="space-y-0">
        <div className="border-b border-zinc-200 py-3 dark:border-zinc-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="mb-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Version 0.1.0
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                You're up to date!
              </div>
            </div>
            <button onClick={openLatestRelease} className={settingsButtonClassName}>
              Check for Updates
            </button>
          </div>
        </div>

        <div className="border-b border-zinc-200 py-3 dark:border-zinc-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="mb-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Auto Update
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                When disabled, NekoTick will not update automatically.
              </div>
            </div>
            <button
              onClick={toggleAutoUpdate}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                autoUpdate ? 'bg-zinc-400 dark:bg-zinc-500' : 'bg-zinc-300 dark:bg-zinc-600'
              }`}
            >
              <span className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white transition-transform ${
                autoUpdate ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>

        <div className="border-b border-zinc-200 py-3 dark:border-zinc-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="mb-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Language
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Change the interface language.
              </div>
            </div>
            <select className={selectClassName} style={selectStyle}>
              <option value="en-US">English</option>
              <option value="zh-CN">Simplified Chinese</option>
            </select>
          </div>
        </div>

        <div className="border-b border-zinc-200 py-3 dark:border-zinc-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="mb-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                GitHub Repository
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                View source code, report issues, or contribute.
              </div>
            </div>
            <button onClick={openGitHub} className={`${settingsButtonClassName} flex items-center gap-1.5`}>
              <Icon size="md" name="nav.external" />
              Open
            </button>
          </div>
        </div>

        <div className="border-b border-zinc-200 py-3 dark:border-zinc-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="mb-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Discord Community
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Join our community for support and discussions.
              </div>
            </div>
            <button
              onClick={() => openUrl('https://discord.gg/TtUzNPqNJw')}
              className={`${settingsButtonClassName} flex items-center gap-1.5`}
            >
              <Icon size="md" name="nav.external" />
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

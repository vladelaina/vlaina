import { useState, useEffect } from 'react';
import { MdOpenInNew, MdCloud, MdCloudOff, MdRefresh, MdDownload, MdError } from 'react-icons/md';
import { openUrl } from '@tauri-apps/plugin-opener';
import { selectClassName, selectStyle, settingsButtonClassName } from '../styles';
import { useGithubSyncStore } from '@/stores/useGithubSyncStore';
import { STORAGE_KEY_AUTO_UPDATE } from '@/lib/config';

/**
 * About tab content - cloud sync, subscription status, version, updates, language
 */
export function AboutTab() {
  const [autoUpdate, setAutoUpdate] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_AUTO_UPDATE);
    return saved !== null ? JSON.parse(saved) : true;
  });

  const {
    isConnected,
    username,
    isSyncing,
    isConnecting,
    lastSyncTime,
    syncError,
    hasRemoteData,
    isLoading,
    connect,
    disconnect,
    syncToCloud,
    restoreFromCloud,
    clearError,
    checkStatus,
  } = useGithubSyncStore();

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const handleConnect = async () => {
    clearError();
    await connect();
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handleSync = async () => {
    clearError();
    if (!isConnected) return;
    await syncToCloud();
  };

  const handleRestore = async () => {
    if (confirm('This will replace your local data with the cloud backup. Continue?')) {
      clearError();
      await restoreFromCloud();
    }
  };

  const toggleAutoUpdate = () => {
    const newValue = !autoUpdate;
    setAutoUpdate(newValue);
    localStorage.setItem(STORAGE_KEY_AUTO_UPDATE, JSON.stringify(newValue));
  };

  const openGitHub = async () => {
    await openUrl('https://github.com/NekoTick/NekoTick');
  };

  return (
    <div className="max-w-3xl">
      {/* Cloud Sync Section */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Cloud Sync</h2>
        
        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <MdCloud className="size-5 text-green-500" />
              ) : (
                <MdCloudOff className="size-5 text-zinc-400" />
              )}
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {isConnected ? 'Connected to GitHub' : 'Not Connected'}
                </div>
                {isConnected && username && (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    @{username}
                  </div>
                )}
              </div>
            </div>
            
            {isLoading ? (
              <MdRefresh className="size-[18px] animate-spin text-zinc-400" />
            ) : isConnected ? (
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-600 border border-zinc-300 dark:border-zinc-600 rounded-md transition-colors disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <MdRefresh className="size-[18px] animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <MdCloud className="size-[18px]" />
                    Connect GitHub
                  </>
                )}
              </button>
            )}
          </div>

          {/* Sync Actions (only when connected) */}
          {isConnected && (
            <>
              <div className="h-px bg-zinc-200 dark:bg-zinc-700" />
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-zinc-700 dark:text-zinc-300">
                    Last synced: {formatLastSync(lastSyncTime)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {hasRemoteData && (
                    <button
                      onClick={handleRestore}
                      disabled={isSyncing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-md transition-colors disabled:opacity-50"
                      title="Restore from cloud backup"
                    >
                      <MdDownload className="size-[18px]" />
                      Restore
                    </button>
                  )}
                  
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-800 dark:bg-zinc-600 hover:bg-zinc-700 dark:hover:bg-zinc-500 rounded-md transition-colors disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <>
                        <MdRefresh className="size-[18px] animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <MdRefresh className="size-[18px]" />
                        Sync Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Error Message */}
          {syncError && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
              <MdError className="size-[18px] flex-shrink-0 mt-0.5" />
              <div className="text-xs">{syncError}</div>
            </div>
          )}
        </div>
        
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
          Sync your data to GitHub Gist for backup and cross-device access
        </p>
      </div>

      {/* Open Source Licenses Section */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Open Source Licenses</h2>
        
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-700/50">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Material Design Icons</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Apache 2.0</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Google's Material Design Icons are used throughout this application.
            </p>
          </div>
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50">
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono leading-relaxed">
              Licensed under the Apache License, Version 2.0 (the "License");
              you may not use this file except in compliance with the License.
              You may obtain a copy of the License at
              http://www.apache.org/licenses/LICENSE-2.0
            </p>
          </div>
        </div>
      </div>

      {/* App Section */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">App</h2>
      </div>

      <div className="space-y-0">
        {/* Version */}
        <div className="py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-0.5">
                Version 0.1.0
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                You're up to date!
              </div>
            </div>
            <button
              onClick={() => {/* TODO: Check for updates */}}
              className={settingsButtonClassName}
            >
              Check for Updates
            </button>
          </div>
        </div>

        {/* Auto Update */}
        <div className="py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-0.5">
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
              <span className={`inline-block w-[18px] h-[18px] transform rounded-full bg-white transition-transform ${
                autoUpdate ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>

        {/* Language */}
        <div className="py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-0.5">
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

        {/* GitHub */}
        <div className="py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-0.5">
                GitHub Repository
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                View source code, report issues, or contribute.
              </div>
            </div>
            <button
              onClick={openGitHub}
              className={`${settingsButtonClassName} flex items-center gap-1.5`}
            >
              <MdOpenInNew className="size-[18px]" />
              Open
            </button>
          </div>
        </div>

        {/* Discord */}
        <div className="py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-0.5">
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
              <MdOpenInNew className="size-[18px]" />
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

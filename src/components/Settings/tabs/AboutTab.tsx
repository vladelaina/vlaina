import { useState, useEffect } from 'react';
import { ExternalLink, Cloud, CloudOff, RefreshCw, Download, Loader2, CircleAlert, Crown, KeyRound } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { selectClassName, selectStyle, settingsButtonClassName } from '../styles';
import { useGithubSyncStore } from '@/stores/useGithubSyncStore';
import { useLicenseStore } from '@/stores/useLicenseStore';
import { githubCommands } from '@/lib/tauri/invoke';
import { STORAGE_KEY_AUTO_UPDATE } from '@/lib/config';

/**
 * About tab content - cloud sync, license, version, updates, language
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

  const {
    isProUser,
    licenseKey,
    expiresAt,
    getExpiryDaysRemaining,
  } = useLicenseStore();

  // License key input state
  const [licenseInput, setLicenseInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

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

  const formatExpiryDate = (timestamp: number | null) => {
    if (!timestamp) return 'Permanent';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Check if license is expiring soon (within 3 days)
  const isExpiringSoon = () => {
    const daysRemaining = getExpiryDaysRemaining();
    return daysRemaining !== null && daysRemaining <= 3 && daysRemaining > 0;
  };

  // Format license key input (auto-add dashes)
  const formatLicenseInput = (value: string) => {
    // Remove all non-alphanumeric characters
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Add NEKO- prefix if not present
    let formatted = clean;
    if (!clean.startsWith('NEKO')) {
      formatted = 'NEKO' + clean;
    }
    
    // Split into parts and join with dashes
    const parts = [];
    if (formatted.length > 0) parts.push(formatted.slice(0, 4)); // NEKO
    if (formatted.length > 4) parts.push(formatted.slice(4, 8));
    if (formatted.length > 8) parts.push(formatted.slice(8, 12));
    if (formatted.length > 12) parts.push(formatted.slice(12, 16));
    
    return parts.join('-');
  };

  const handleLicenseInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatLicenseInput(e.target.value);
    // Limit to NEKO-XXXX-XXXX-XXXX format (19 chars)
    setLicenseInput(formatted.slice(0, 19));
    setActivateError(null);
  };

  const handleActivateLicense = async () => {
    if (!isConnected) {
      setActivateError('Please connect to GitHub first');
      return;
    }

    const key = licenseInput.trim().toUpperCase();
    if (!/^NEKO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
      setActivateError('Invalid license key format');
      return;
    }

    setIsActivating(true);
    setActivateError(null);

    try {
      const result = await githubCommands.bindLicenseKey(key);
      if (result?.isPro) {
        // Update license store
        useLicenseStore.getState().setProStatus(
          true,
          result.licenseKey,
          result.expiresAt ? Math.floor(result.expiresAt / 1000) : null
        );
        setLicenseInput('');
      } else {
        setActivateError('Failed to activate license');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Parse error code from message
      if (errorMsg.includes('INVALID_KEY')) {
        setActivateError('Invalid license key');
      } else if (errorMsg.includes('ALREADY_BOUND')) {
        setActivateError('This license is already bound to another account');
      } else if (errorMsg.includes('REVOKED')) {
        setActivateError('This license has been revoked');
      } else if (errorMsg.includes('EXPIRED')) {
        setActivateError('This license has expired');
      } else {
        setActivateError(errorMsg);
      }
    } finally {
      setIsActivating(false);
    }
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
                <Cloud className="size-5 text-green-500" />
              ) : (
                <CloudOff className="size-5 text-zinc-400" />
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
              <Loader2 className="size-4 animate-spin text-zinc-400" />
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
                    <Loader2 className="size-3.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Cloud className="size-3.5" />
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
                      <Download className="size-3.5" />
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
                        <Loader2 className="size-3.5 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="size-3.5" />
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
              <CircleAlert className="size-4 flex-shrink-0 mt-0.5" />
              <div className="text-xs">{syncError}</div>
            </div>
          )}
        </div>
        
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
          Sync your data to GitHub Gist for backup and cross-device access
        </p>
      </div>

      {/* PRO License Section */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">PRO License</h2>
        
        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-4">
          {isProUser ? (
            // PRO Activated
            <>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Crown className="size-5 text-amber-500" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    👑 PRO Activated
                  </div>
                  {licenseKey && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {licenseKey}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-zinc-200 dark:bg-zinc-700" />
              
              <div className="text-sm">
                {isExpiringSoon() ? (
                  <div className="text-red-600 dark:text-red-400">
                    ⚠️ Membership expiring soon ({getExpiryDaysRemaining()} days remaining)
                  </div>
                ) : expiresAt ? (
                  <div className="text-zinc-500 dark:text-zinc-400">
                    Valid until: {formatExpiryDate(expiresAt)}
                  </div>
                ) : (
                  <div className="text-green-600 dark:text-green-400">
                    Permanent
                  </div>
                )}
              </div>
            </>
          ) : (
            // Not PRO - show activation form
            <>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-700">
                  <Crown className="size-5 text-zinc-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Free User
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Upgrade to PRO for automatic cloud sync
                  </div>
                </div>
              </div>

              <div className="h-px bg-zinc-200 dark:bg-zinc-700" />

              {/* License Key Input */}
              <div className="space-y-3">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Enter your license key to activate PRO:
                </div>
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                    <input
                      type="text"
                      value={licenseInput}
                      onChange={handleLicenseInputChange}
                      placeholder="NEKO-XXXX-XXXX-XXXX"
                      disabled={!isConnected || isActivating}
                      className="w-full pl-9 pr-3 py-2 text-sm font-mono bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <button
                    onClick={handleActivateLicense}
                    disabled={!isConnected || isActivating || licenseInput.length < 19}
                    className="px-4 py-2 text-sm font-medium text-white bg-zinc-800 dark:bg-zinc-600 hover:bg-zinc-700 dark:hover:bg-zinc-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isActivating ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Activating...
                      </>
                    ) : (
                      'Activate'
                    )}
                  </button>
                </div>

                {/* Error Message */}
                {activateError && (
                  <div className="flex items-start gap-2 p-2 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                    <CircleAlert className="size-4 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">{activateError}</div>
                  </div>
                )}

                {/* Connect GitHub hint */}
                {!isConnected && (
                  <div className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Please connect to GitHub first to activate your license
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
          PRO enables automatic cloud sync. License is bound to your GitHub account.
        </p>
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
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
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
              <option value="zh-CN">简体中文</option>
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
              <ExternalLink className="size-3.5" />
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
              <ExternalLink className="size-3.5" />
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

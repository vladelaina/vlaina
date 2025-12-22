import { useState, useEffect } from 'react';
import { ExternalLink, Cloud, CloudOff, RefreshCw, Download, Loader2, AlertCircle, Crown, KeyRound, Unlink } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { selectClassName, selectStyle, settingsButtonClassName } from '../styles';
import { useSyncStore } from '@/stores/useSyncStore';
import { useLicenseStore } from '@/stores/useLicenseStore';

/**
 * About tab content - cloud sync, license, version, updates, language
 */
export function AboutTab() {
  const [autoUpdate, setAutoUpdate] = useState<boolean>(() => {
    const saved = localStorage.getItem('autoUpdate');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [licenseInput, setLicenseInput] = useState('');

  const {
    isConnected,
    userEmail,
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
  } = useSyncStore();

  const {
    isProUser,
    isLoading: isLicenseLoading,
    licenseKey,
    activatedAt,
    inGracePeriod,
    gracePeriodEndsAt,
    timeTamperDetected,
    error: licenseError,
    isActivating,
    isDeactivating,
    isValidating,
    checkStatus: checkLicenseStatus,
    activate,
    deactivate,
    clearError: clearLicenseError,
    validateBackground,
  } = useLicenseStore();

  useEffect(() => {
    checkStatus();
    checkLicenseStatus();
  }, [checkStatus, checkLicenseStatus]);

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
    if (confirm('Are you sure you want to disconnect from Google Drive?')) {
      await disconnect();
    }
  };

  const handleSync = async () => {
    clearError();
    if (!isConnected) {
      // This shouldn't happen as button is only shown when connected
      // but handle it gracefully
      return;
    }
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
    localStorage.setItem('autoUpdate', JSON.stringify(newValue));
  };

  const openGitHub = async () => {
    await openUrl('https://github.com/NekoTick/NekoTick');
  };

  const handleActivate = async () => {
    clearLicenseError();
    const success = await activate(licenseInput);
    if (success) {
      setLicenseInput('');
    }
  };

  const handleDeactivate = async () => {
    if (confirm('确定要解绑此设备吗？解绑后可在其他设备上使用此激活码。')) {
      await deactivate();
    }
  };

  const handleLicenseKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isActivating) {
      handleActivate();
    }
  };

  const formatActivatedDate = (timestamp: number | null) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
                  {isConnected ? 'Connected to Google Drive' : 'Not Connected'}
                </div>
                {isConnected && userEmail && (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {userEmail}
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
                    Connect Google Drive
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
              <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
              <div className="text-xs">{syncError}</div>
            </div>
          )}
        </div>
        
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
          Sync your data to Google Drive for backup and cross-device access
        </p>
      </div>

      {/* PRO License Section */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">PRO License</h2>
        
        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-4">
          {isLicenseLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-5 animate-spin text-zinc-400" />
            </div>
          ) : timeTamperDetected && licenseKey ? (
            // Time tamper detected - show warning
            <>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <AlertCircle className="size-5 text-amber-500" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    需要验证
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {licenseKey}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  检测到系统时间异常，请连接网络后点击验证按钮恢复 PRO 状态。
                </div>
              </div>

              <button
                onClick={() => validateBackground()}
                disabled={isValidating}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors disabled:opacity-50"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    验证中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-4" />
                    验证许可证
                  </>
                )}
              </button>
            </>
          ) : isProUser ? (
            // Activated state
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Crown className="size-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      👑 PRO Activated
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {licenseKey}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleDeactivate}
                  disabled={isDeactivating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50"
                >
                  {isDeactivating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Unbinding...
                    </>
                  ) : (
                    <>
                      <Unlink className="size-3.5" />
                      Unbind Device
                    </>
                  )}
                </button>
              </div>

              <div className="h-px bg-zinc-200 dark:bg-zinc-700" />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                    Activated
                  </div>
                  <div className="text-zinc-900 dark:text-zinc-100">
                    {formatActivatedDate(activatedAt)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                    Status
                  </div>
                  <div className="text-zinc-900 dark:text-zinc-100">
                    {inGracePeriod ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        Grace Period (until {formatActivatedDate(gracePeriodEndsAt)})
                      </span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">Active</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Not activated state
            <>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-700">
                  <KeyRound className="size-5 text-zinc-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Activate PRO
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Enter your license key to unlock auto-sync
                  </div>
                </div>
              </div>

              <div className="h-px bg-zinc-200 dark:bg-zinc-700" />

              <div className="flex gap-2">
                <input
                  type="text"
                  value={licenseInput}
                  onChange={(e) => setLicenseInput(e.target.value.toUpperCase())}
                  onKeyDown={handleLicenseKeyDown}
                  placeholder="NEKO-XXXX-XXXX-XXXX"
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
                  disabled={isActivating}
                />
                <button
                  onClick={handleActivate}
                  disabled={isActivating || !licenseInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-zinc-800 dark:bg-zinc-600 hover:bg-zinc-700 dark:hover:bg-zinc-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

              {licenseError && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                  <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">{licenseError}</div>
                </div>
              )}
            </>
          )}
        </div>
        
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
          PRO enables automatic cloud sync. Each license supports up to 5 devices.
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
      </div>
    </div>
  );
}

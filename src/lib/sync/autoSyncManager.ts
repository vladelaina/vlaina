/**
 * AutoSyncManager - Manages automatic sync for PRO users
 * 
 * Features:
 * - Debounce: Wait 5 seconds after data change before syncing
 * - Cooldown: Minimum 30 seconds between syncs
 * - Exponential backoff retry: 30s, 60s, 120s, 300s, 300s
 * - Max 5 retries before stopping
 */

import { useGithubSyncStore } from '@/stores/useGithubSyncStore';
import { useLicenseStore } from '@/stores/useLicenseStore';

export interface AutoSyncConfig {
  debounceMs: number;
  cooldownMs: number;
  maxRetries: number;
  retryDelays: number[];
}

const DEFAULT_CONFIG: AutoSyncConfig = {
  debounceMs: 5000,      // 5 seconds debounce
  cooldownMs: 30000,     // 30 seconds cooldown
  maxRetries: 5,
  retryDelays: [30000, 60000, 120000, 300000, 300000], // 30s, 1m, 2m, 5m, 5m
};

class AutoSyncManagerImpl {
  private config: AutoSyncConfig;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSyncTime: number = 0;
  private retryCount: number = 0;

  constructor(config: Partial<AutoSyncConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Trigger auto sync with debounce
   * Called when data changes
   */
  triggerSync(): void {
    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Check if we can sync
    if (!this.canSync()) {
      console.log('[AutoSync] Cannot sync - conditions not met');
      return;
    }

    // Mark pending sync
    useGithubSyncStore.getState().setSyncStatus('pending');

    // Set debounce timer
    this.debounceTimer = setTimeout(() => {
      this.executeSync();
    }, this.config.debounceMs);

    console.log('[AutoSync] Sync scheduled in', this.config.debounceMs, 'ms');
  }

  /**
   * Execute sync immediately (skip debounce)
   * Used for manual retry
   */
  async syncNow(): Promise<boolean> {
    // Clear any pending timers
    this.clearTimers();

    // Reset retry count for manual retry
    // Note: GitHub sync store doesn't have retry count, just clear error
    useGithubSyncStore.getState().clearError();

    return this.executeSync();
  }

  /**
   * Check if sync can be triggered
   */
  canSync(): boolean {
    const syncState = useGithubSyncStore.getState();
    const licenseState = useLicenseStore.getState();

    // Must be connected to GitHub
    if (!syncState.isConnected) {
      return false;
    }

    // Must be PRO user
    if (!licenseState.isProUser) {
      return false;
    }

    // Not already syncing
    if (syncState.isSyncing) {
      return false;
    }

    return true;
  }

  /**
   * Check if cooldown period has passed
   */
  private isCooldownPassed(): boolean {
    const now = Date.now();
    return now - this.lastSyncTime >= this.config.cooldownMs;
  }

  /**
   * Execute the actual sync
   */
  private async executeSync(): Promise<boolean> {
    // Check cooldown
    if (!this.isCooldownPassed()) {
      const remainingCooldown = this.config.cooldownMs - (Date.now() - this.lastSyncTime);
      console.log('[AutoSync] In cooldown, scheduling retry in', remainingCooldown, 'ms');
      
      // Schedule sync after cooldown
      this.debounceTimer = setTimeout(() => {
        this.executeSync();
      }, remainingCooldown);
      
      return false;
    }

    // Double check conditions
    if (!this.canSync()) {
      console.log('[AutoSync] Conditions no longer met, skipping sync');
      return false;
    }

    console.log('[AutoSync] Executing sync...');
    
    const success = await useGithubSyncStore.getState().syncBidirectional();
    
    if (success) {
      this.lastSyncTime = Date.now();
      console.log('[AutoSync] Sync successful');
      return true;
    } else {
      // Handle failure - schedule retry
      this.scheduleRetry();
      return false;
    }
  }

  /**
   * Schedule retry with exponential backoff
   */
  private scheduleRetry(): void {
    const retryCount = this.retryCount;

    if (retryCount >= this.config.maxRetries) {
      console.log('[AutoSync] Max retries reached, stopping auto-retry');
      useGithubSyncStore.getState().setSyncStatus('error');
      return;
    }

    // Increment retry count
    this.retryCount++;

    // Get delay for this retry
    const delay = this.config.retryDelays[Math.min(retryCount, this.config.retryDelays.length - 1)];
    
    console.log('[AutoSync] Scheduling retry', retryCount + 1, 'in', delay, 'ms');

    this.retryTimer = setTimeout(() => {
      this.executeSync();
    }, delay);
  }

  /**
   * Reset retry count
   */
  resetRetryCount(): void {
    this.retryCount = 0;
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Destroy manager (cleanup)
   */
  destroy(): void {
    this.clearTimers();
  }

  /**
   * Get current config (for testing)
   */
  getConfig(): AutoSyncConfig {
    return { ...this.config };
  }
}

// Singleton instance
let instance: AutoSyncManagerImpl | null = null;

export function getAutoSyncManager(config?: Partial<AutoSyncConfig>): AutoSyncManagerImpl {
  if (!instance) {
    instance = new AutoSyncManagerImpl(config);
  }
  return instance;
}

export function resetAutoSyncManager(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

// Export type for testing
export type AutoSyncManager = AutoSyncManagerImpl;

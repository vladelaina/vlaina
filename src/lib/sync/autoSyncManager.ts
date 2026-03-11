import { useGithubSyncStore } from '@/stores/githubSync';

export interface AutoSyncConfig {
  debounceMs: number;
  cooldownMs: number;
  maxRetries: number;
  retryDelays: number[];
}

const DEFAULT_CONFIG: AutoSyncConfig = {
  debounceMs: 5000,
  cooldownMs: 30000,
  maxRetries: 5,
  retryDelays: [30000, 60000, 120000, 300000, 300000],
};

class AutoSyncManagerImpl {
  private config: AutoSyncConfig;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSyncTime: number = 0;
  private retryCount: number = 0;

  constructor(config: Partial<AutoSyncConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  triggerSync(): void {
    this.clearTimers();
    this.retryCount = 0;

    if (!this.canSync()) {
      return;
    }

    useGithubSyncStore.getState().setSyncStatus('pending');

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.executeSync();
    }, this.config.debounceMs);
  }

  async syncNow(): Promise<boolean> {
    this.clearTimers();
    useGithubSyncStore.getState().clearError();
    return this.executeSync();
  }

  canSync(): boolean {
    const syncState = useGithubSyncStore.getState();

    if (!syncState.isConnected) {
      return false;
    }

    if (syncState.isSyncing) {
      return false;
    }

    return true;
  }

  private isCooldownPassed(): boolean {
    const now = Date.now();
    return now - this.lastSyncTime >= this.config.cooldownMs;
  }

  private async executeSync(): Promise<boolean> {
    if (!this.isCooldownPassed()) {
      const remainingCooldown = this.config.cooldownMs - (Date.now() - this.lastSyncTime);

      this.cooldownTimer = setTimeout(() => {
        this.cooldownTimer = null;
        this.executeSync();
      }, remainingCooldown);

      return false;
    }

    if (!this.canSync()) {
      return false;
    }

    const success = await useGithubSyncStore.getState().syncBidirectional();

    if (success) {
      this.lastSyncTime = Date.now();
      this.retryCount = 0;
      return true;
    } else {
      this.scheduleRetry();
      return false;
    }
  }

  private scheduleRetry(): void {
    const retryCount = this.retryCount;

    if (retryCount >= this.config.maxRetries) {
      useGithubSyncStore.getState().setSyncStatus('error');
      return;
    }

    this.retryCount++;

    const delay = this.config.retryDelays[Math.min(retryCount, this.config.retryDelays.length - 1)];

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.executeSync();
    }, delay);
  }

  resetRetryCount(): void {
    this.retryCount = 0;
  }

  private clearTimers(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  destroy(): void {
    this.clearTimers();
  }

  getConfig(): AutoSyncConfig {
    return { ...this.config };
  }
}

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

export type AutoSyncManager = AutoSyncManagerImpl;

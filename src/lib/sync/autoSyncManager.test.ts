/**
 * Property-based tests for AutoSyncManager
 *
 * Feature: auto-sync
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import * as fc from 'fast-check';
import { getAutoSyncManager, resetAutoSyncManager, AutoSyncConfig } from './autoSyncManager';
import { useGithubSyncStore } from '@/stores/useGithubSyncStore';

// Mock store
vi.mock('@/stores/useGithubSyncStore', () => ({
  useGithubSyncStore: {
    getState: vi.fn(() => ({
      isConnected: true,
      isSyncing: false,
      setSyncStatus: vi.fn(),
      clearError: vi.fn(),
      syncBidirectional: vi.fn().mockResolvedValue(true),
    })),
  },
}));

const mockSyncStoreGetState = useGithubSyncStore.getState as Mock;

describe('AutoSyncManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAutoSyncManager();

    mockSyncStoreGetState.mockReturnValue({
      isConnected: true,
      isSyncing: false,
      setSyncStatus: vi.fn(),
      clearError: vi.fn(),
      syncBidirectional: vi.fn().mockResolvedValue(true),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAutoSyncManager();
  });

  describe('Auto trigger behavior', () => {
    it('should debounce rapid sync triggers', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 10 }), (triggerCount) => {
          resetAutoSyncManager();
          const manager = getAutoSyncManager({ debounceMs: 5000 });
          const mockSyncBidirectional = vi.fn().mockResolvedValue(true);

          mockSyncStoreGetState.mockReturnValue({
            isConnected: true,
            isSyncing: false,
            setSyncStatus: vi.fn(),
            clearError: vi.fn(),
            syncBidirectional: mockSyncBidirectional,
          });

          for (let i = 0; i < triggerCount; i++) {
            manager.triggerSync();
            vi.advanceTimersByTime(100);
          }

          expect(mockSyncBidirectional).not.toHaveBeenCalled();

          vi.advanceTimersByTime(5000);

          expect(mockSyncBidirectional).toHaveBeenCalledTimes(1);

          resetAutoSyncManager();
        }),
        { numRuns: 100 }
      );
    });

    it('should enforce cooldown period between syncs', async () => {
      const manager = getAutoSyncManager({ debounceMs: 100, cooldownMs: 30000 });
      const mockSyncBidirectional = vi.fn().mockResolvedValue(true);

      mockSyncStoreGetState.mockReturnValue({
        isConnected: true,
        isSyncing: false,
        setSyncStatus: vi.fn(),
        clearError: vi.fn(),
        syncBidirectional: mockSyncBidirectional,
      });

      manager.triggerSync();
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(mockSyncBidirectional).toHaveBeenCalledTimes(1);

      manager.triggerSync();
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(mockSyncBidirectional).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(mockSyncBidirectional).toHaveBeenCalledTimes(2);
    });

    it('canSync should return false when not connected', () => {
      mockSyncStoreGetState.mockReturnValue({
        isConnected: false,
        isSyncing: false,
      });

      const manager = getAutoSyncManager();
      expect(manager.canSync()).toBe(false);
    });

    it('canSync should return false when already syncing', () => {
      mockSyncStoreGetState.mockReturnValue({
        isConnected: true,
        isSyncing: true,
      });

      const manager = getAutoSyncManager();
      expect(manager.canSync()).toBe(false);
    });

    it('canSync should return true when connected and idle', () => {
      mockSyncStoreGetState.mockReturnValue({
        isConnected: true,
        isSyncing: false,
      });

      const manager = getAutoSyncManager();
      expect(manager.canSync()).toBe(true);
    });
  });

  describe('Retry strategy', () => {
    it('should use correct retry delays', () => {
      const expectedDelays = [30000, 60000, 120000, 300000, 300000];
      const manager = getAutoSyncManager();
      const config = manager.getConfig();

      expect(config.retryDelays).toEqual(expectedDelays);
    });

    it('syncNow should clear error', async () => {
      const mockClearError = vi.fn();

      mockSyncStoreGetState.mockReturnValue({
        isConnected: true,
        isSyncing: false,
        setSyncStatus: vi.fn(),
        clearError: mockClearError,
        syncBidirectional: vi.fn().mockResolvedValue(true),
      });

      const manager = getAutoSyncManager();
      await manager.syncNow();

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 10000 }),
          fc.integer({ min: 10000, max: 60000 }),
          fc.integer({ min: 1, max: 10 }),
          (debounceMs, cooldownMs, maxRetries) => {
            resetAutoSyncManager();

            const customConfig: Partial<AutoSyncConfig> = {
              debounceMs,
              cooldownMs,
              maxRetries,
            };

            const manager = getAutoSyncManager(customConfig);
            const config = manager.getConfig();

            expect(config.debounceMs).toBe(debounceMs);
            expect(config.cooldownMs).toBe(cooldownMs);
            expect(config.maxRetries).toBe(maxRetries);

            resetAutoSyncManager();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

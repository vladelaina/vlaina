/**
 * Property-based tests for SyncButton
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import { SyncButton } from './SyncButton';
import type { GithubSyncStatusType } from '@/stores/githubSync';

interface MockSyncStore {
  isConnected: boolean;
  isSyncing: boolean;
  syncStatus: GithubSyncStatusType;
  syncToCloud: ReturnType<typeof vi.fn>;
  syncError: string | null;
}

const mockSyncStore: MockSyncStore = {
  isConnected: true,
  isSyncing: false,
  syncStatus: 'idle',
  syncToCloud: vi.fn(),
  syncError: null,
};

vi.mock('@/stores/githubSync', () => ({
  useGithubSyncStore: () => mockSyncStore,
}));

describe('SyncButton', () => {
  beforeEach(() => {
    mockSyncStore.isConnected = true;
    mockSyncStore.isSyncing = false;
    mockSyncStore.syncStatus = 'idle';
    mockSyncStore.syncError = null;
  });

  describe('Visibility', () => {
    it('should only be visible when connected to GitHub', () => {
      fc.assert(
        fc.property(fc.boolean(), (isConnected) => {
          mockSyncStore.isConnected = isConnected;

          const { container } = render(<SyncButton />);
          const button = container.querySelector('button');

          if (isConnected) {
            expect(button).not.toBeNull();
          } else {
            expect(button).toBeNull();
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Visual feedback', () => {
    it('should show error indicator when syncStatus is error', () => {
      mockSyncStore.syncStatus = 'error';
      mockSyncStore.syncError = 'Some error';

      const { container } = render(<SyncButton />);
      const dot = container.querySelector('.bg-red-500');
      expect(dot).not.toBeNull();
    });

    it('should show spinning animation when syncing', () => {
      mockSyncStore.isSyncing = true;

      const { container } = render(<SyncButton />);
      const spinningIcon = container.querySelector('.animate-spin');
      expect(spinningIcon).not.toBeNull();
    });

    it('should show normal state when idle', () => {
      mockSyncStore.syncStatus = 'idle';
      mockSyncStore.syncError = null;

      const { container } = render(<SyncButton />);
      const redDot = container.querySelector('.bg-red-500');
      expect(redDot).toBeNull();
    });

    it('should handle all status combinations correctly', () => {
      const statuses = ['idle', 'pending', 'syncing', 'success', 'error'] as const;

      fc.assert(
        fc.property(fc.constantFrom(...statuses), fc.boolean(), (status, isSyncing) => {
          mockSyncStore.syncStatus = status;
          mockSyncStore.isSyncing = isSyncing;
          mockSyncStore.syncError = status === 'error' ? 'Error' : null;

          const { container } = render(<SyncButton />);
          const button = container.querySelector('button');

          expect(button).not.toBeNull();

          if (isSyncing) {
            expect(container.querySelector('.animate-spin')).not.toBeNull();
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});

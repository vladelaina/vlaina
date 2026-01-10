/**
 * Property-based tests for SyncButton
 * 
 * Feature: auto-sync
 * Property 2: Manual sync button visibility
 * Property 3: Sync status visual feedback
 * Validates: Requirements 2.1, 2.7, 2.8, 3.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import { SyncButton } from './SyncButton';
import type { GithubSyncStatusType } from '@/stores/useGithubSyncStore';

// Mock stores with proper types
interface MockSyncStore {
  isConnected: boolean;
  isSyncing: boolean;
  syncStatus: GithubSyncStatusType;
  syncToCloud: ReturnType<typeof vi.fn>;
  syncError: string | null;
}

interface MockLicenseStore {
  isProUser: boolean;
}

const mockSyncStore: MockSyncStore = {
  isConnected: true,
  isSyncing: false,
  syncStatus: 'idle',
  syncToCloud: vi.fn(),
  syncError: null,
};

const mockLicenseStore: MockLicenseStore = {
  isProUser: false,
};

vi.mock('@/stores/useGithubSyncStore', () => ({
  useGithubSyncStore: () => mockSyncStore,
}));

vi.mock('@/stores/useLicenseStore', () => ({
  useLicenseStore: () => mockLicenseStore,
}));

describe('SyncButton', () => {
  beforeEach(() => {
    // Reset mocks
    mockSyncStore.isConnected = true;
    mockSyncStore.isSyncing = false;
    mockSyncStore.syncStatus = 'idle';
    mockSyncStore.syncError = null;
    mockLicenseStore.isProUser = false;
  });

  describe('Property 2: Manual sync button visibility', () => {
    /**
     * Property 2.1, 2.7, 2.8: Button visibility based on user state
     * For any combination of (PRO/non-PRO) × (connected/not connected),
     * button should only be visible when: non-PRO AND connected
     */
    it('should only be visible for non-PRO users connected to GitHub', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isProUser
          fc.boolean(), // isConnected
          (isProUser, isConnected) => {
            // Setup
            mockLicenseStore.isProUser = isProUser;
            mockSyncStore.isConnected = isConnected;

            // Render
            const { container } = render(<SyncButton />);

            // Expected visibility: non-PRO AND connected
            const shouldBeVisible = !isProUser && isConnected;

            if (shouldBeVisible) {
              // Button should be rendered
              expect(container.querySelector('button')).not.toBeNull();
            } else {
              // Button should not be rendered
              expect(container.querySelector('button')).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * PRO users should never see the button
     */
    it('should never show for PRO users regardless of connection status', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isConnected
          (isConnected) => {
            mockLicenseStore.isProUser = true;
            mockSyncStore.isConnected = isConnected;

            const { container } = render(<SyncButton />);
            expect(container.querySelector('button')).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Disconnected users should never see the button
     */
    it('should never show when not connected to GitHub', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isProUser
          (isProUser) => {
            mockLicenseStore.isProUser = isProUser;
            mockSyncStore.isConnected = false;

            const { container } = render(<SyncButton />);
            expect(container.querySelector('button')).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Sync status visual feedback', () => {
    /**
     * Property 3.2: Visual states
     * For any sync status, the button should show appropriate visual feedback
     */
    it('should show error indicator when syncStatus is error', () => {
      mockSyncStore.syncStatus = 'error';
      mockSyncStore.syncError = 'Some error';

      const { container } = render(<SyncButton />);
      
      // Should have an error indicator dot
      const dot = container.querySelector('.bg-red-500');
      expect(dot).not.toBeNull();
    });

    it('should show spinning animation when syncing', () => {
      mockSyncStore.isSyncing = true;

      const { container } = render(<SyncButton />);
      
      // Should have animate-spin class
      const spinningIcon = container.querySelector('.animate-spin');
      expect(spinningIcon).not.toBeNull();
    });

    it('should show normal state when idle', () => {
      mockSyncStore.syncStatus = 'idle';
      mockSyncStore.syncError = null;

      const { container } = render(<SyncButton />);
      
      // Should not have any indicator dots
      const redDot = container.querySelector('.bg-red-500');
      expect(redDot).toBeNull();
    });

    /**
     * Status combinations should produce correct visual states
     */
    it('should handle all status combinations correctly', () => {
      const statuses = ['idle', 'pending', 'syncing', 'success', 'error'] as const;
      
      fc.assert(
        fc.property(
          fc.constantFrom(...statuses),
          fc.boolean(), // isSyncing
          (status, isSyncing) => {
            mockSyncStore.syncStatus = status;
            mockSyncStore.isSyncing = isSyncing;
            mockSyncStore.syncError = status === 'error' ? 'Error' : null;

            const { container } = render(<SyncButton />);
            const button = container.querySelector('button');
            
            // Button should always be rendered (for non-PRO connected users)
            expect(button).not.toBeNull();

            // If syncing, should show spinning animation
            if (isSyncing) {
              expect(container.querySelector('.animate-spin')).not.toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

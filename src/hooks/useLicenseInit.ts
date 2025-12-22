/**
 * Hook to initialize license status on app startup
 * 
 * Checks license status and triggers background validation if needed.
 * Also sets up periodic validation checks for PRO users.
 */

import { useEffect, useRef } from 'react';
import { useLicenseStore } from '@/stores/useLicenseStore';

// Check license status every 6 hours (validation needed after 72 hours)
const LICENSE_CHECK_INTERVAL = 6 * 60 * 60 * 1000;

export function useLicenseInit() {
  const checkStatus = useLicenseStore((state) => state.checkStatus);
  const validateBackground = useLicenseStore((state) => state.validateBackground);
  const isProUser = useLicenseStore((state) => state.isProUser);
  const needsValidation = useLicenseStore((state) => state.needsValidation);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasValidatedRef = useRef(false);

  // Initial status check on app startup
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Trigger background validation if needed (only once per session)
  useEffect(() => {
    if (isProUser && needsValidation && !hasValidatedRef.current) {
      hasValidatedRef.current = true;
      validateBackground();
    }
  }, [isProUser, needsValidation, validateBackground]);

  // Set up periodic validation check for PRO users
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only set up interval if PRO user
    if (isProUser) {
      intervalRef.current = setInterval(() => {
        // Reset validation flag for periodic checks
        hasValidatedRef.current = false;
        checkStatus();
      }, LICENSE_CHECK_INTERVAL);
    }

    // Cleanup on unmount or when PRO status changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isProUser, checkStatus]);
}

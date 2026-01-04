// License Init Hook - Initialize license status on app startup

import { useEffect, useRef } from 'react';
import { useLicenseStore } from '@/stores/useLicenseStore';

const LICENSE_CHECK_INTERVAL = 6 * 60 * 60 * 1000;

export function useLicenseInit() {
  const ensureTrial = useLicenseStore((state) => state.ensureTrial);
  const checkStatus = useLicenseStore((state) => state.checkStatus);
  const validateBackground = useLicenseStore((state) => state.validateBackground);
  const isProUser = useLicenseStore((state) => state.isProUser);
  const isTrial = useLicenseStore((state) => state.isTrial);
  const needsValidation = useLicenseStore((state) => state.needsValidation);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasValidatedRef = useRef(false);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const init = async () => {
      await ensureTrial();
      await checkStatus();
    };
    init();
  }, [ensureTrial, checkStatus]);

  useEffect(() => {
    if (isProUser && !isTrial && needsValidation && !hasValidatedRef.current) {
      hasValidatedRef.current = true;
      validateBackground();
    }
  }, [isProUser, isTrial, needsValidation, validateBackground]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isProUser) {
      intervalRef.current = setInterval(() => {
        hasValidatedRef.current = false;
        checkStatus();
      }, LICENSE_CHECK_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isProUser, checkStatus]);
}

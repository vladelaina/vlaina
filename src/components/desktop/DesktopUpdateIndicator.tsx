import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  getDesktopUpdateIndicatorVersion,
  readCachedDesktopUpdateInfo,
  UPDATE_INFO_CHANGED_EVENT,
} from '@/lib/desktop/updateStatus';

export function useDesktopUpdateIndicatorVersion() {
  const [version, setVersion] = useState(() =>
    getDesktopUpdateIndicatorVersion(readCachedDesktopUpdateInfo())
  );

  useEffect(() => {
    const applyUpdateIndicator = () => {
      setVersion(getDesktopUpdateIndicatorVersion(readCachedDesktopUpdateInfo()));
    };

    applyUpdateIndicator();
    window.addEventListener(UPDATE_INFO_CHANGED_EVENT, applyUpdateIndicator);
    return () => {
      window.removeEventListener(UPDATE_INFO_CHANGED_EVENT, applyUpdateIndicator);
    };
  }, []);

  return version;
}

export function DesktopUpdateBadge({
  version,
  className,
}: {
  version: string;
  className?: string;
}) {
  const { t } = useI18n();
  if (!version) return null;

  return (
    <span
      data-desktop-update-indicator="badge"
      className={cn(
        'inline-flex h-5 max-w-[var(--vlaina-size-120px)] shrink-0 items-center rounded-[var(--vlaina-radius-pill)] bg-[var(--vlaina-accent)] px-2 text-[var(--vlaina-font-10)] font-bold leading-none text-[var(--vlaina-color-white)] tabular-nums shadow-[var(--vlaina-shadow-selection-soft)]',
        className
      )}
      title={t('settings.updateIndicator')}
    >
      <span className="truncate">{t('settings.updateIndicator')}</span>
    </span>
  );
}

import { useCallback, useEffect, useState } from 'react';
import {
  type CommunitySettings,
  getCachedCommunitySettings,
  loadCommunitySettings,
} from '@/components/Settings/tabs/aboutCommunitySettings';
import {
  OPEN_SETTINGS_EVENT,
  resolveSettingsOpenTab,
  type OpenSettingsDetail,
  type SettingsOpenTab,
} from '@/components/Settings/settingsEvents';

export function useAppSettingsController() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsRequestedTab, setSettingsRequestedTab] = useState<SettingsOpenTab | undefined>();
  const [hasOpenedSettings, setHasOpenedSettings] = useState(false);
  const [communitySettings, setCommunitySettings] = useState<CommunitySettings>(() => getCachedCommunitySettings());

  useEffect(() => {
    if (settingsOpen) {
      setHasOpenedSettings(true);
      void loadCommunitySettings().then(setCommunitySettings);
    }
  }, [settingsOpen]);

  useEffect(() => {
    const handleOpenSettings = (event: Event) => {
      const detail = (event as CustomEvent<OpenSettingsDetail>).detail;
      if (resolveSettingsOpenTab(detail?.tab)) {
        setSettingsRequestedTab(detail.tab);
      } else {
        setSettingsRequestedTab(undefined);
      }
      setSettingsOpen(true);
    };
    const handleToggleSettings = () => setSettingsOpen((open) => !open);
    window.addEventListener(OPEN_SETTINGS_EVENT, handleOpenSettings);
    window.addEventListener('toggle-settings', handleToggleSettings);
    return () => {
      window.removeEventListener(OPEN_SETTINGS_EVENT, handleOpenSettings);
      window.removeEventListener('toggle-settings', handleToggleSettings);
    };
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  return {
    closeSettings,
    communitySettings,
    hasOpenedSettings,
    settingsOpen,
    settingsRequestedTab,
  };
}

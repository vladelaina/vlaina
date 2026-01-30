import { useCallback, useEffect } from 'react';
import { useUnifiedStore } from '@/stores/useUnifiedStore';
import { saveGlobalAsset } from '@/lib/storage/assetStorage';
import type { CustomIcon } from '@/lib/storage/unifiedStorage';

const EMPTY_ICONS: CustomIcon[] = [];

export function useGlobalIconUpload() {
  const addCustomIcon = useUnifiedStore(s => s.addCustomIcon);
  const removeCustomIcon = useUnifiedStore(s => s.removeCustomIcon);
  const syncCustomIcons = useUnifiedStore(s => s.syncCustomIcons);
  const customIcons = useUnifiedStore(s => s.data.customIcons || EMPTY_ICONS);
  
  // Auto-discover existing icons on mount
  useEffect(() => {
    syncCustomIcons();
  }, [syncCustomIcons]);
  
  const handleUpload = useCallback(async (file: File) => {
      try {
          const path = await saveGlobalAsset(file, 'icons');
          // Protocol "img:" signals UniversalIcon to use the loader
          const assetUrl = `img:${path}`; 
          
          addCustomIcon({
              id: path,
              url: assetUrl,
              name: file.name,
              createdAt: Date.now()
          });
          return { success: true, url: assetUrl };
      } catch (e) {
          console.error(e);
          return { success: false, error: 'Upload failed' };
      }
  }, [addCustomIcon]);
  
  return {
      customIcons,
      onUploadFile: handleUpload,
      onDeleteCustomIcon: removeCustomIcon
  };
}
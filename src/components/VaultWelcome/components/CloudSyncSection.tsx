/**
 * CloudSyncSection - Cloud sync providers
 * Google Drive is already implemented in Settings
 * Hidden when already connected
 */

import { IconBrandGoogle, IconBrandApple, IconBrandOnedrive, IconBrandGithub } from '@tabler/icons-react';
import { useSyncStore } from '@/stores/useSyncStore';

export function CloudSyncSection() {
  const { isConnected, connect, isConnecting } = useSyncStore();

  // Don't show if already connected
  if (isConnected) {
    return null;
  }

  const handleGoogleConnect = async () => {
    await connect();
  };

  return (
    <div className="vault-cloud">
      <div className="vault-cloud__divider">or</div>
      
      <div className="vault-cloud__container">
        <div className="vault-cloud__header">
          <h3 className="vault-cloud__title">Sync with Cloud</h3>
        </div>
        
        <div className="vault-cloud__providers">
          <button
            className="vault-cloud__provider vault-cloud__provider--google"
            title="Google Drive"
            onClick={handleGoogleConnect}
            disabled={isConnecting}
          >
            <IconBrandGoogle size={20} />
          </button>
          <button
            className="vault-cloud__provider"
            title="Apple - Coming Soon"
            disabled
          >
            <IconBrandApple size={20} />
          </button>
          <button
            className="vault-cloud__provider"
            title="OneDrive - Coming Soon"
            disabled
          >
            <IconBrandOnedrive size={20} />
          </button>
          <button
            className="vault-cloud__provider"
            title="GitHub - Coming Soon"
            disabled
          >
            <IconBrandGithub size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

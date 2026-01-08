/**
 * CloudSyncSection - Cloud sync providers
 * Google Drive is already implemented in Settings
 * Hidden when already connected
 */

import { IconBrandGoogle, IconBrandApple, IconBrandOnedrive, IconBrandGithub } from '@tabler/icons-react';
import { useSyncStore } from '@/stores/useSyncStore';

// Insignias
import googleDriveIcon from '@/assets/welcome-insignias/google_drive.png';
import icloudIcon from '@/assets/welcome-insignias/icloud.png';
import onedriveIcon from '@/assets/welcome-insignias/onedrive.png';
import githubIcon from '@/assets/welcome-insignias/github.png';

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
      <div className="vault-welcome__divider">
        <span>SYNC WITH CLOUD</span>
      </div>

      <div className="vault-cloud__container">
        <div className="vault-cloud__header">
          <h3 className="vault-cloud__title">Sync with Cloud</h3>
        </div>

        <div className="vault-cloud__providers">
          <button
            className="vault-cloud__provider vault-cloud__provider--google"
            title="Connect with Google Drive"
            onClick={handleGoogleConnect}
            disabled={isConnecting}
          >
            <img
              src={googleDriveIcon}
              alt="Google Drive"
              className="vault-cloud__icon-img"
            />
          </button>

          {/* Replaced 'Apple' with 'iCloud' as primary Apple service */}
          <button
            className="vault-cloud__provider vault-cloud__provider--icloud"
            title="Connect with iCloud"
          >
            <img
              src={icloudIcon}
              alt="iCloud"
              className="vault-cloud__icon-img vault-cloud__icon-img--icloud"
            />
          </button>

          <button
            className="vault-cloud__provider vault-cloud__provider--onedrive"
            title="Connect with OneDrive"
          >
            <img
              src={onedriveIcon}
              alt="OneDrive"
              className="vault-cloud__icon-img"
            />
          </button>

          <button
            className="vault-cloud__provider vault-cloud__provider--github"
            title="Connect with GitHub"
          >
            <img
              src={githubIcon}
              alt="GitHub"
              className="vault-cloud__icon-img vault-cloud__icon-img--github"
            />
          </button>
        </div>
      </div>
    </div>
  );
}

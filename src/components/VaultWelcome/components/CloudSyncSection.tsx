/**
 * CloudSyncSection - Cloud sync providers
 * Google Drive is already implemented in Settings
 * Hidden when already connected
 */

// Tabler icons removed
import { useSyncStore } from '@/stores/useSyncStore';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="vault-cloud__provider vault-cloud__provider--google"
                onClick={handleGoogleConnect}
                disabled={isConnecting}
              >
                <img
                  src={googleDriveIcon}
                  alt="Google Drive"
                  className="vault-cloud__icon-img"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              <p>Connect with Google Drive</p>
            </TooltipContent>
          </Tooltip>

          {/* Replaced 'Apple' with 'iCloud' as primary Apple service */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="vault-cloud__provider vault-cloud__provider--icloud"
              >
                <img
                  src={icloudIcon}
                  alt="iCloud"
                  className="vault-cloud__icon-img vault-cloud__icon-img--icloud"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              <p>Connect with iCloud</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="vault-cloud__provider vault-cloud__provider--onedrive"
              >
                <img
                  src={onedriveIcon}
                  alt="OneDrive"
                  className="vault-cloud__icon-img"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              <p>Connect with OneDrive</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="vault-cloud__provider vault-cloud__provider--github"
              >
                <img
                  src={githubIcon}
                  alt="GitHub"
                  className="vault-cloud__icon-img vault-cloud__icon-img--github"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              <p>Connect with GitHub</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

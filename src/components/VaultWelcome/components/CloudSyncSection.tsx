/**
 * CloudSyncSection - GitHub cloud sync
 * Hidden when already connected
 */

import { useGithubSyncStore } from '@/stores/useGithubSyncStore';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import githubIcon from '@/assets/welcome-insignias/github.png';

export function CloudSyncSection() {
  const { isConnected, connect, isConnecting } = useGithubSyncStore();

  // Don't show if already connected
  if (isConnected) {
    return null;
  }

  const handleGithubConnect = async () => {
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
                className="vault-cloud__provider vault-cloud__provider--github"
                onClick={handleGithubConnect}
                disabled={isConnecting}
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
/**
 * RecentVaultsList - Display recent vaults (IDEA style)
 */

import { IconX } from '@tabler/icons-react';
import { useVaultStore, type VaultInfo } from '@/stores/useVaultStore';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function formatPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const home = normalized.includes('/Users/')
    ? normalized.replace(/.*\/Users\/[^/]+/, '~')
    : normalized.replace(/^[A-Z]:/, '');

  if (home.length > 35) {
    const parts = home.split('/');
    if (parts.length > 3) {
      return `${parts[0]}/.../${parts.slice(-2).join('/')}`;
    }
  }
  return home;
}

interface RecentVaultsListProps {
  vaults: VaultInfo[];
  onOpen: (path: string) => void;
}

export function RecentVaultsList({ vaults, onOpen }: RecentVaultsListProps) {
  const { removeFromRecent } = useVaultStore();

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeFromRecent(id);
  };

  return (
    <div className="vault-recent">
      <h2 className="vault-recent__title">Recent</h2>
      <div className="vault-recent__list">
        {vaults.map((vault) => (
          <Tooltip key={vault.id}>
            <TooltipTrigger asChild>
              <button
                className="vault-item"
                onClick={() => onOpen(vault.path)}
              >
                <span className="vault-item__name">{vault.name}</span>
                <span className="vault-item__path">{formatPath(vault.path)}</span>
                <button
                  className="vault-item__remove"
                  onClick={(e) => handleRemove(e, vault.id)}
                >
                  <IconX size={12} />
                </button>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={10} showArrow={false}>
              <p className="max-w-[300px] break-all">{vault.path}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

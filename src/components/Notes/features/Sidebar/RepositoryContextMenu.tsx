/**
 * RepositoryContextMenu - Right-click context menu for repositories
 * 
 * Provides quick actions: Sync Now, Pull, Push, Open in GitHub, Remove from List
 */

import { useEffect, useRef, useCallback } from 'react';
import { 
  RefreshCw, 
  Download, 
  Upload, 
  ExternalLink, 
  Trash2
} from 'lucide-react';
import { useGithubReposStore } from '@/stores/useGithubReposStore';
import { type RepositoryInfo } from '@/lib/tauri/invoke';
import { cn } from '@/lib/utils';

interface RepositoryContextMenuProps {
  repository: RepositoryInfo;
  position: { x: number; y: number };
  onClose: () => void;
}

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

export function RepositoryContextMenu({ 
  repository, 
  position, 
  onClose 
}: RepositoryContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    syncRepository,
    pullChanges,
    pushChanges,
    removeRepository,
    hasPendingChanges,
    syncStatus,
  } = useGithubReposStore();

  const status = syncStatus.get(repository.id);
  const isSyncing = status === 'syncing';
  const hasPending = hasPendingChanges(repository.id);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${position.x - rect.width}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${position.y - rect.height}px`;
      }
    }
  }, [position]);

  const handleSyncNow = useCallback(async () => {
    onClose();
    await syncRepository(repository.id);
  }, [repository.id, syncRepository, onClose]);

  const handlePull = useCallback(async () => {
    onClose();
    await pullChanges(repository.id);
  }, [repository.id, pullChanges, onClose]);

  const handlePush = useCallback(async () => {
    onClose();
    await pushChanges(repository.id);
  }, [repository.id, pushChanges, onClose]);

  const handleOpenInGitHub = useCallback(() => {
    onClose();
    window.open(repository.htmlUrl, '_blank');
  }, [repository.htmlUrl, onClose]);

  const handleRemove = useCallback(() => {
    onClose();
    removeRepository(repository.id);
  }, [repository.id, removeRepository, onClose]);

  const menuItems: MenuItem[] = [
    {
      icon: <RefreshCw className="w-4 h-4" />,
      label: 'Sync Now',
      onClick: handleSyncNow,
      disabled: isSyncing,
    },
    {
      icon: <Download className="w-4 h-4" />,
      label: 'Pull from Remote',
      onClick: handlePull,
      disabled: isSyncing,
    },
    {
      icon: <Upload className="w-4 h-4" />,
      label: 'Push to Remote',
      onClick: handlePush,
      disabled: isSyncing || !hasPending,
    },
    {
      icon: <ExternalLink className="w-4 h-4" />,
      label: 'Open in GitHub',
      onClick: handleOpenInGitHub,
      divider: true,
    },
    {
      icon: <Trash2 className="w-4 h-4" />,
      label: 'Remove from List',
      onClick: handleRemove,
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 min-w-[180px] py-1 rounded-lg",
        "bg-[var(--neko-bg-primary)] border border-[var(--neko-border)]",
        "shadow-lg"
      )}
      style={{ left: position.x, top: position.y }}
    >
      {menuItems.map((item, index) => (
        <div key={index}>
          {item.divider && index > 0 && (
            <div className="my-1 border-t border-[var(--neko-border)]" />
          )}
          <button
            onClick={item.onClick}
            disabled={item.disabled}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-1.5",
              "text-[13px] text-left transition-colors",
              item.danger
                ? "text-red-400 hover:bg-red-500/10"
                : "text-[var(--neko-text-primary)] hover:bg-[var(--neko-hover)]",
              item.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
            )}
          >
            <span className={cn(
              item.danger ? "text-red-400" : "text-[var(--neko-text-tertiary)]"
            )}>
              {item.icon}
            </span>
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAIStore } from '@/stores/useAIStore';
import { SettingsSwitch } from '@/components/Settings/components/SettingsFields';
import { ProviderDetail } from './ai/ProviderDetail';
import { AIBehaviorSettings } from './ai/AIBehaviorSettings';
import { cn } from '@/lib/utils';
import { MANAGED_PROVIDER_ID } from '@/lib/ai/managedService';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { Icon } from '@/components/ui/icons';

interface ProviderCardDraft {
  name?: string;
  apiHost?: string;
}

interface PendingDeleteProvider {
  id: string;
  name: string;
}

const detailTransitionVariants = {
  initial: (direction: number) => ({
    opacity: 0,
    x: direction < 0 ? -34 : 34,
    scale: 0.992,
  }),
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction < 0 ? 28 : -28,
    scale: 0.992,
  }),
};

function formatChannelBaseUrl(baseUrl: string) {
  return baseUrl.replace(/^https?:\/\//i, '');
}

function ChannelObject({
  name,
  baseUrl,
  enabled,
  modelCount,
  active = false,
  onClick,
  onMiddleClick,
  onToggleEnabled,
  onDelete,
}: {
  name: string;
  baseUrl: string;
  enabled: boolean;
  modelCount: number;
  active?: boolean;
  onClick?: () => void;
  onMiddleClick?: () => void;
  onToggleEnabled?: (enabled: boolean) => void;
  onDelete?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      onMouseDown={(event) => {
        if (event.button !== 1) {
          return;
        }
        event.preventDefault();
      }}
      onMouseUp={(event) => {
        if (event.button !== 1) {
          return;
        }
        onMiddleClick?.();
      }}
      className={cn(
        'group/channel relative min-h-[112px] rounded-[26px] border transition-all duration-200 cursor-pointer border-transparent',
        active
          ? 'bg-[var(--sidebar-row-selected-bg)] dark:bg-[rgba(65,168,234,0.12)]'
          : chatComposerPillSurfaceClass
      )}
    >
      <div className="block w-full px-5 pb-3 pt-5 text-left">
        <div className="min-w-0 pr-7">
          <div className={cn(
            "truncate text-[14px] font-bold",
            active ? "text-[var(--sidebar-row-selected-text)]" : "text-[var(--notes-sidebar-text)]"
          )}>
            {name}
          </div>
        </div>
        <div className={cn(
          "mt-1 line-clamp-1 pr-7 text-[12px]",
          active ? "text-[var(--sidebar-row-selected-text)]/80" : "text-[var(--notes-sidebar-text-soft)]"
        )}>
          {baseUrl ? formatChannelBaseUrl(baseUrl) : 'Not configured yet'}
        </div>
      </div>

      <div className={cn(
        "flex items-center justify-between px-5 pb-5 text-[11px] font-bold",
        active ? "text-[var(--sidebar-row-selected-text)]/70" : "text-[var(--notes-sidebar-text-soft)]"
      )}>
        <span>{modelCount} model{modelCount === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete?.();
            }}
            aria-label={`Delete ${name}`}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--notes-sidebar-text-soft)] opacity-0 group-hover/channel:opacity-100 transition-all duration-200 hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-red-500"
          >
            <Icon name="common.trash" size="xs" />
          </button>
          <SettingsSwitch
            checked={enabled}
            onChange={(nextEnabled) => onToggleEnabled?.(nextEnabled)}
            className="origin-right scale-[0.84]"
            activeColor="bg-[var(--sidebar-row-selected-text)]"
          />
        </div>
      </div>
    </div>
  );
}

function CreateChannelObject({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Create channel"
      className={cn(
        "flex min-h-[112px] items-center justify-center rounded-[26px] border border-transparent transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]",
        chatComposerPillSurfaceClass
      )}
    >
      <div className="flex flex-col items-center gap-1">
        <div className="text-[24px] font-light leading-none text-[var(--notes-sidebar-text-soft)]">+</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--notes-sidebar-text-soft)]">New Channel</div>
      </div>
    </button>
  );
}

export function AITab() {
  const { providers, models, addProvider, updateProvider, deleteProvider } = useAIStore();
  const customProviders = useMemo(
    () => providers.filter((provider) => provider.id !== MANAGED_PROVIDER_ID),
    [providers]
  );
  const providerModelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    models.forEach((model) => {
      counts.set(model.providerId, (counts.get(model.providerId) || 0) + 1);
    });
    return counts;
  }, [models]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providerDrafts, setProviderDrafts] = useState<Record<string, ProviderCardDraft>>({});
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteProvider | null>(null);
  const [detailTransitionDirection, setDetailTransitionDirection] = useState(1);

  useEffect(() => {
    if (customProviders.length === 0) {
      setSelectedProviderId(null);
      return;
    }

    const preferredId = customProviders[0].id;

    if (!selectedProviderId) {
      setDetailTransitionDirection(1);
      setSelectedProviderId(preferredId);
    } else {
      const exists = customProviders.some((provider) => provider.id === selectedProviderId);
      if (!exists) {
        setDetailTransitionDirection(1);
        setSelectedProviderId(preferredId);
      }
    }
  }, [customProviders, selectedProviderId]);

  useEffect(() => {
    const providerIds = new Set(customProviders.map((provider) => provider.id));
    setProviderDrafts((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([providerId]) => providerIds.has(providerId))
      );
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [customProviders]);

  const currentProvider = selectedProviderId
    ? customProviders.find((provider) => provider.id === selectedProviderId)
    : undefined;

  const handleSelectProvider = (id: string) => {
    if (id === selectedProviderId) {
      return;
    }

    const currentIndex = selectedProviderId
      ? customProviders.findIndex((provider) => provider.id === selectedProviderId)
      : -1;
    const nextIndex = customProviders.findIndex((provider) => provider.id === id);

    if (currentIndex !== -1 && nextIndex !== -1) {
      setDetailTransitionDirection(nextIndex < currentIndex ? -1 : 1);
    } else {
      setDetailTransitionDirection(1);
    }

    setSelectedProviderId(id);
  };

  const handleAddCustomProvider = () => {
    const customIndex = customProviders.length + 1;
    setDetailTransitionDirection(1);
    const nextId = addProvider({
      name: `Channel ${customIndex}`,
      type: 'newapi',
      apiHost: '',
      apiKey: '',
      enabled: true,
    });
    setSelectedProviderId(nextId);
  };

  const handleToggleProviderEnabled = (id: string, enabled: boolean) => {
    updateProvider(id, { enabled, updatedAt: Date.now() });
  };

  const deleteCustomProviderById = (providerId: string) => {
    if (selectedProviderId === providerId) {
      const currentIndex = customProviders.findIndex((provider) => provider.id === providerId);
      const remainingProviders = customProviders.filter((provider) => provider.id !== providerId);
      const fallbackProvider =
        remainingProviders[currentIndex] ?? remainingProviders[currentIndex - 1] ?? null;

      if (fallbackProvider) {
        const fallbackIndex = customProviders.findIndex((provider) => provider.id === fallbackProvider.id);
        setDetailTransitionDirection(fallbackIndex < currentIndex ? -1 : 1);
        setSelectedProviderId(fallbackProvider.id);
      } else {
        setSelectedProviderId(null);
      }
    }

    setProviderDrafts((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });
    deleteProvider(providerId);
  };

  const handleDeleteCustomProvider = (id: string, name: string) => {
    const provider = customProviders.find((item) => item.id === id);
    if (!provider) {
      return;
    }

    if (!provider.apiKey.trim()) {
      deleteCustomProviderById(id);
      return;
    }

    setPendingDelete({ id, name });
  };

  const confirmDeleteCustomProvider = () => {
    if (!pendingDelete) {
      return;
    }

    deleteCustomProviderById(pendingDelete.id);
    setPendingDelete(null);
  };

  const handleProviderDraftChange = (providerId: string, draft: ProviderCardDraft) => {
    setProviderDrafts((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        ...draft,
      },
    }));
  };

  const handleProviderDraftClear = (providerId: string) => {
    setProviderDrafts((prev) => {
      if (!prev[providerId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[providerId];
      return next;
    });
  };

  const hasCustomProviders = customProviders.length > 0;

  return (
    <div className="h-full bg-[#fcfcfc] dark:bg-[#1E1E1E] text-[var(--notes-sidebar-text)]">
      <ConfirmDialog
        isOpen={!!pendingDelete}
        title={`Delete ${pendingDelete?.name || 'this channel'}?`}
        description="This will remove this channel and its models from chat."
        confirmText="Delete Channel"
        cancelText="Cancel"
        variant="danger"
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDeleteCustomProvider}
      />

      <div className="h-full px-6 py-6 overflow-y-auto">
        <AIBehaviorSettings />

        <section className="mx-auto max-w-5xl">
          <div className="mb-4 px-2">
            <h3 className="text-[13px] font-medium text-[var(--notes-sidebar-text-soft)]">
              Custom Channels
            </h3>
          </div>

          <AnimatePresence initial={false} mode="popLayout">
            {hasCustomProviders ? (
              <motion.div
                key="channels-populated"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="mb-5"
              >
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {customProviders.map((provider) => (
                    (() => {
                      const draft = providerDrafts[provider.id];
                      return (
                        <ChannelObject
                          key={provider.id}
                          name={draft?.name ?? provider.name}
                          baseUrl={draft?.apiHost ?? provider.apiHost ?? ''}
                          enabled={provider.enabled ?? true}
                          modelCount={providerModelCounts.get(provider.id) || 0}
                          active={provider.id === selectedProviderId}
                          onClick={() => handleSelectProvider(provider.id)}
                          onMiddleClick={() =>
                            handleDeleteCustomProvider(provider.id, draft?.name ?? provider.name)
                          }
                          onToggleEnabled={(nextEnabled) =>
                            handleToggleProviderEnabled(provider.id, nextEnabled)
                          }
                          onDelete={() =>
                            handleDeleteCustomProvider(provider.id, draft?.name ?? provider.name)
                          }
                        />
                      );
                    })()
                  ))}
                  <CreateChannelObject onClick={handleAddCustomProvider} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="channels-empty"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="mb-8 px-1"
              >
                <motion.button
                  type="button"
                  onClick={handleAddCustomProvider}
                  aria-label="Create channel"
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "w-full rounded-[26px] border border-transparent px-6 py-8 text-left transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]",
                    chatComposerPillSurfaceClass
                  )}
                >
                  <div className="mx-auto flex w-fit flex-col items-center gap-3">
                    <div className="h-[10px] w-[128px] rounded-full bg-zinc-200/80 dark:bg-white/12" />
                    <div className="h-[10px] w-[88px] rounded-full bg-zinc-100 dark:bg-white/7" />
                  </div>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {currentProvider ? (
            <ProviderDetail
              key={currentProvider.id}
              provider={currentProvider}
              onDraftChange={(draft) => handleProviderDraftChange(currentProvider.id, draft)}
              onDraftClear={() => handleProviderDraftClear(currentProvider.id)}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

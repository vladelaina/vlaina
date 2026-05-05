import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAIStore } from '@/stores/useAIStore';
import { SettingsSwitch } from '@/components/Settings/components/SettingsFields';
import { ProviderDetail } from './ai/ProviderDetail';
import { AIBehaviorSettings } from './ai/AIBehaviorSettings';
import { cn } from '@/lib/utils';
import { MANAGED_PROVIDER_ID } from '@/lib/ai/managedService';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

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
        'relative min-h-[112px] rounded-[22px] border transition-colors cursor-pointer',
        active
          ? 'border-emerald-200 bg-emerald-50/75 dark:border-emerald-500/20 dark:bg-emerald-500/10'
          : 'border-zinc-200/80 bg-white hover:border-zinc-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20'
      )}
    >
      <div className="block w-full px-4 pb-3 pt-4 text-left">
        <div className="min-w-0 pr-7">
          <div className="truncate text-[14px] font-semibold text-zinc-950 dark:text-zinc-100">{name}</div>
        </div>
        <div className="mt-1 line-clamp-1 pr-7 text-[12px] text-zinc-500 dark:text-zinc-400">
          {baseUrl ? formatChannelBaseUrl(baseUrl) : 'Not configured yet'}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-4 text-[11px] text-zinc-400 dark:text-zinc-500">
        <span>{modelCount} model{modelCount === 1 ? '' : 's'}</span>
        <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <SettingsSwitch
            checked={enabled}
            onChange={(nextEnabled) => onToggleEnabled?.(nextEnabled)}
            className="origin-right scale-[0.84]"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete?.();
        }}
        aria-label={`Delete ${name}`}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-[15px] leading-none text-zinc-400 transition-colors hover:text-red-500"
      >
        ×
      </button>
    </div>
  );
}

function CreateChannelObject({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Create channel"
      className="flex min-h-[112px] items-center justify-center rounded-[24px] border border-zinc-200/80 bg-white text-zinc-400 transition-colors hover:border-zinc-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-500 dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
    >
      <div className="flex flex-col items-center">
        <div className="text-[28px] font-light leading-none">+</div>
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
    <div className="h-full bg-white dark:bg-[#1E1E1E]">
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
          <div className="mb-3 px-1">
            <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
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
                  className="w-full rounded-[26px] border border-zinc-200/90 bg-zinc-50/40 px-6 py-8 text-left transition-colors duration-200 hover:border-zinc-300 hover:bg-zinc-50/60 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
                >
                  <div className="mx-auto flex w-fit flex-col items-center gap-3">
                    <div className="h-[10px] w-[128px] rounded-full bg-zinc-200/80 dark:bg-white/12" />
                    <div className="h-[10px] w-[88px] rounded-full bg-zinc-100 dark:bg-white/7" />
                  </div>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false} mode="wait" custom={detailTransitionDirection}>
            {currentProvider ? (
              <motion.div
                key={currentProvider.id}
                custom={detailTransitionDirection}
                variants={detailTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <ProviderDetail
                  provider={currentProvider}
                  onDraftChange={(draft) => handleProviderDraftChange(currentProvider.id, draft)}
                  onDraftClear={() => handleProviderDraftClear(currentProvider.id)}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

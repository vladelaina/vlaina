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
import { useI18n } from '@/lib/i18n';
import { themeMotionTokens } from '@/styles/themeTokens';

interface ProviderCardDraft {
  name?: string;
  apiHost?: string;
}

interface PendingDeleteProvider {
  id: string;
  name: string;
}

function formatChannelBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(normalized).host.replace(/^www\./i, '');
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] || trimmed;
  }
}

function getChannelBaseUrlTextClassName(label: string) {
  const length = label.length;

  if (length >= 32) {
    return 'text-[var(--vlaina-font-8)] tracking-[var(--vlaina-tracking-tight-sm)]';
  }

  if (length >= 24) {
    return 'text-[var(--vlaina-font-9)] tracking-[var(--vlaina-tracking-tight-sm)]';
  }

  if (length >= 18) {
    return 'text-[var(--vlaina-font-10)]';
  }

  return 'text-[var(--vlaina-font-xs)]';
}

function ChannelObject({
  providerId,
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
  providerId: string;
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
  const { t } = useI18n();
  const baseUrlLabel = baseUrl ? formatChannelBaseUrl(baseUrl) : t('settings.ai.notConfiguredYet');

  return (
    <div
      role="button"
      tabIndex={0}
      data-settings-ai-channel-card={providerId}
      data-active={active ? 'true' : undefined}
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
        'group/channel relative min-h-[var(--vlaina-size-112px)] rounded-[var(--vlaina-radius-26px)] border transition-all duration-[var(--vlaina-duration-200)] cursor-pointer border-transparent',
        active
          ? 'bg-[var(--vlaina-sidebar-row-selected-bg)]'
          : chatComposerPillSurfaceClass
      )}
    >
      <div className="block w-full px-5 pb-3 pt-5 text-left">
        <div className="min-w-0 pr-7">
          <div className={cn(
            "truncate text-[var(--vlaina-font-sm)] font-bold",
            active ? "text-[var(--vlaina-sidebar-row-selected-text)]" : "text-[var(--vlaina-sidebar-notes-text)]"
          )}>
            {name}
          </div>
        </div>
        <div className={cn(
          "mt-1 line-clamp-1 pr-7",
          getChannelBaseUrlTextClassName(baseUrlLabel),
          active ? "text-[var(--vlaina-sidebar-row-selected-text-soft)]" : "text-[var(--vlaina-sidebar-notes-text-soft)]"
        )}
          title={baseUrl || undefined}
        >
          {baseUrlLabel}
        </div>
      </div>

      <div className={cn(
        "flex items-center justify-between px-5 pb-5 text-[var(--vlaina-font-11)] font-bold",
        active ? "text-[var(--vlaina-sidebar-row-selected-text-muted)]" : "text-[var(--vlaina-sidebar-notes-text-soft)]"
      )}>
        <span className="shrink-0 whitespace-nowrap leading-none">{t('settings.ai.modelCount', { count: modelCount })}</span>
        <div className="flex h-7 shrink-0 items-center gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            data-settings-ai-action="delete-channel"
            onClick={(event) => {
              event.stopPropagation();
              onDelete?.();
            }}
            aria-label={t('settings.ai.deleteChannelNamed', { name })}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--vlaina-sidebar-notes-text-soft)] opacity-[var(--vlaina-opacity-0)] transition-all duration-[var(--vlaina-duration-200)] hover:bg-transparent hover:text-[var(--vlaina-color-status-danger-fg)] hover:shadow-[var(--vlaina-shadow-none)] group-hover/channel:opacity-[var(--vlaina-opacity-100)] focus-visible:opacity-[var(--vlaina-opacity-100)] dark:hover:bg-transparent"
          >
            <Icon name="common.close" size="xs" />
          </button>
          <SettingsSwitch
            data-settings-control="ai-channel-enabled"
            checked={enabled}
            onChange={(nextEnabled) => onToggleEnabled?.(nextEnabled)}
            className="origin-right scale-[var(--vlaina-scale-84)]"
            activeColor="bg-[var(--vlaina-sidebar-row-selected-text)]"
          />
        </div>
      </div>
    </div>
  );
}

function CreateChannelObject({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('settings.ai.newChannel')}
      data-settings-ai-action="new-channel"
      className={cn(
        "flex min-h-[var(--vlaina-size-112px)] items-center justify-center rounded-[var(--vlaina-radius-26px)] border border-transparent transition-all duration-[var(--vlaina-duration-200)] shadow-[var(--vlaina-shadow-sm)] hover:shadow-[var(--vlaina-shadow-md)] active:scale-[var(--vlaina-scale-98)]",
        chatComposerPillSurfaceClass
      )}
    >
      <div className="flex flex-col items-center gap-1">
        <div className="text-[var(--vlaina-font-24)] font-light leading-none text-[var(--vlaina-sidebar-notes-text-soft)]">+</div>
        <div className="text-[var(--vlaina-font-10)] font-bold uppercase tracking-widest text-[var(--vlaina-sidebar-notes-text-soft)]">{t('settings.ai.newChannel')}</div>
      </div>
    </button>
  );
}

export function AITab() {
  const { t } = useI18n();
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

  useEffect(() => {
    if (customProviders.length === 0) {
      setSelectedProviderId(null);
      return;
    }

    const preferredId = customProviders[0].id;

    if (!selectedProviderId) {
      setSelectedProviderId(preferredId);
    } else {
      const exists = customProviders.some((provider) => provider.id === selectedProviderId);
      if (!exists) {
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

    setSelectedProviderId(id);
  };

  const handleAddCustomProvider = () => {
    const customIndex = customProviders.length + 1;
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
    <div
      className="h-full bg-[var(--vlaina-color-setting-panel)] text-[var(--vlaina-sidebar-notes-text)]"
      data-settings-tab-panel="ai"
    >
      <ConfirmDialog
        isOpen={!!pendingDelete}
        title={t('settings.ai.deleteChannelTitle', { name: pendingDelete?.name || t('settings.ai.thisChannel') })}
        description={t('settings.ai.deleteChannelDescription')}
        confirmText={t('settings.ai.deleteChannel')}
        cancelText={t('common.cancel')}
        variant="danger"
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDeleteCustomProvider}
      />

      <div className="h-full px-6 py-6 overflow-y-auto">
        <AIBehaviorSettings />

        <section className="mx-auto max-w-5xl">
          <div className="mb-4 px-2">
            <h3 className="text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-sidebar-notes-text-soft)]">
              {t('settings.ai.customChannels')}
            </h3>
          </div>

          <AnimatePresence initial={false} mode="popLayout">
            {hasCustomProviders ? (
              <motion.div
                key="channels-populated"
                initial={{
                  opacity: themeMotionTokens.opacityHidden,
                  y: themeMotionTokens.aiChannelPopulatedInitialY,
                }}
                animate={{
                  opacity: themeMotionTokens.opacityVisible,
                  y: themeMotionTokens.toastVisibleY,
                }}
                exit={{
                  opacity: themeMotionTokens.opacityHidden,
                  y: themeMotionTokens.aiChannelPopulatedExitY,
                }}
                transition={{
                  duration: themeMotionTokens.aiChannelPopulatedDuration,
                  ease: themeMotionTokens.standardEase,
                }}
                className="mb-5"
              >
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {customProviders.map((provider) => (
                    (() => {
                      const draft = providerDrafts[provider.id];
                      return (
                        <ChannelObject
                          key={provider.id}
                          providerId={provider.id}
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
                initial={{
                  opacity: themeMotionTokens.opacityHidden,
                  y: themeMotionTokens.aiChannelEmptyInitialY,
                }}
                animate={{
                  opacity: themeMotionTokens.opacityVisible,
                  y: themeMotionTokens.toastVisibleY,
                }}
                exit={{
                  opacity: themeMotionTokens.opacityHidden,
                  y: themeMotionTokens.aiChannelEmptyExitY,
                }}
                transition={{
                  duration: themeMotionTokens.aiChannelEmptyDuration,
                  ease: themeMotionTokens.standardEase,
                }}
                className="mb-8 px-1"
              >
                <motion.button
                  type="button"
                  onClick={handleAddCustomProvider}
                  aria-label={t('settings.ai.newChannel')}
                  data-settings-ai-action="new-channel"
                  transition={{
                    duration: themeMotionTokens.aiChannelEmptyDuration,
                    ease: themeMotionTokens.standardEase,
                  }}
                  className={cn(
                    "w-full rounded-[var(--vlaina-radius-26px)] border border-transparent px-6 py-8 text-left transition-all duration-[var(--vlaina-duration-200)] shadow-[var(--vlaina-shadow-sm)] hover:shadow-[var(--vlaina-shadow-md)] active:scale-[var(--vlaina-scale-98)]",
                    chatComposerPillSurfaceClass
                  )}
                >
                  <div className="mx-auto flex w-fit flex-col items-center gap-3">
                    <div className="h-[var(--vlaina-size-10px)] w-[var(--vlaina-size-128px)] rounded-full bg-[var(--vlaina-bg-tertiary)]" />
                    <div className="h-[var(--vlaina-size-10px)] w-[var(--vlaina-size-88px)] rounded-full bg-[var(--vlaina-bg-secondary)]" />
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

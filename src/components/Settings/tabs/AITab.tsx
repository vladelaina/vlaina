import { useState, useEffect, useLayoutEffect, useMemo, useRef, type DragEvent } from 'react';
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
import { handleScrollableWheel } from '@/lib/scroll/wheelScroll';

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

const CHANNEL_BASE_URL_MIN_FONT_SIZE_PX = 8;
const CHANNEL_BASE_URL_FIT_GUTTER_PX = 1;

function fitChannelBaseUrlTextToWidth(element: HTMLElement) {
  element.style.fontSize = '';

  const availableWidth = element.clientWidth - CHANNEL_BASE_URL_FIT_GUTTER_PX;
  if (availableWidth <= 0) {
    return;
  }

  const computedFontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
  if (!Number.isFinite(computedFontSize) || computedFontSize <= 0) {
    return;
  }

  const naturalWidth = element.scrollWidth;
  if (naturalWidth <= availableWidth) {
    return;
  }

  const nextFontSize = Math.max(
    CHANNEL_BASE_URL_MIN_FONT_SIZE_PX,
    Math.min(computedFontSize, computedFontSize * (availableWidth / naturalWidth))
  );
  element.style.fontSize = `${nextFontSize}px`;
}

function ChannelBaseUrlLabel({
  label,
  title,
  active,
}: {
  label: string;
  title?: string;
  active?: boolean;
}) {
  const textRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element || typeof window === 'undefined') {
      return;
    }

    let animationFrameId = 0;
    let lastObservedWidth = -1;
    const scheduleFit = (observedWidth?: number) => {
      if (typeof observedWidth === 'number') {
        if (Math.abs(observedWidth - lastObservedWidth) < 0.5) {
          return;
        }
        lastObservedWidth = observedWidth;
      }

      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        fitChannelBaseUrlTextToWidth(element);
      });
    };

    scheduleFit();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver((entries) => {
        const observedWidth = entries[0]?.contentRect.width;
        scheduleFit(observedWidth);
      })
      : null;
    const handleWindowResize = () => scheduleFit();

    if (resizeObserver) {
      resizeObserver.observe(element);
    } else {
      window.addEventListener('resize', handleWindowResize);
    }

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      element.style.fontSize = '';
    };
  }, [label]);

  return (
    <div
      ref={textRef}
      className={cn(
        "mt-1 truncate text-[var(--vlaina-font-xs)]",
        active ? "text-[var(--vlaina-sidebar-row-selected-text-soft)]" : "text-[var(--vlaina-sidebar-notes-text-soft)]"
      )}
      title={title}
    >
      {label}
    </div>
  );
}

function moveProviderIdToTargetIndex(
  providerIds: string[],
  draggedProviderId: string,
  targetProviderId: string
): string[] {
  if (draggedProviderId === targetProviderId) {
    return providerIds;
  }

  const fromIndex = providerIds.indexOf(draggedProviderId);
  const toIndex = providerIds.indexOf(targetProviderId);
  if (fromIndex === -1 || toIndex === -1) {
    return providerIds;
  }

  const nextProviderIds = [...providerIds];
  const [movedProviderId] = nextProviderIds.splice(fromIndex, 1);
  nextProviderIds.splice(toIndex, 0, movedProviderId);
  return nextProviderIds;
}

function areProviderIdsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((providerId, index) => providerId === right[index]);
}

function setTransparentDragImage(dataTransfer: DataTransfer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  dataTransfer.setDragImage(canvas, 0, 0);
}

function ChannelObject({
  providerId,
  name,
  baseUrl,
  enabled,
  modelCount,
  active = false,
  dragging = false,
  dragOver = false,
  onClick,
  onMiddleClick,
  onToggleEnabled,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  providerId: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  modelCount: number;
  active?: boolean;
  dragging?: boolean;
  dragOver?: boolean;
  onClick?: () => void;
  onMiddleClick?: () => void;
  onToggleEnabled?: (enabled: boolean) => void;
  onDelete?: () => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnter?: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const { t } = useI18n();
  const baseUrlLabel = baseUrl ? formatChannelBaseUrl(baseUrl) : t('settings.ai.notConfiguredYet');

  return (
    <div
      role="button"
      tabIndex={0}
      data-settings-ai-channel-card={providerId}
      data-active={active ? 'true' : undefined}
      draggable
      aria-grabbed={dragging ? true : undefined}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
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
        'group/channel relative min-h-[var(--vlaina-size-112px)] cursor-grab rounded-[var(--vlaina-radius-26px)] border transition-all duration-[var(--vlaina-duration-200)] active:cursor-grabbing',
        active
          ? 'bg-[var(--vlaina-sidebar-row-selected-bg)]'
          : chatComposerPillSurfaceClass,
        dragOver
          ? 'border-[var(--vlaina-sidebar-row-selected-text)] shadow-[var(--vlaina-shadow-md)]'
          : 'border-transparent',
        dragging && 'opacity-0'
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
        <ChannelBaseUrlLabel
          label={baseUrlLabel}
          title={baseUrl || undefined}
          active={active}
        />
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
  const { providers, models, addProvider, updateProvider, deleteProvider, reorderCustomProviders } = useAIStore();
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
  const [pendingBaseUrlFocusProviderId, setPendingBaseUrlFocusProviderId] = useState<string | null>(null);
  const [draggingProviderId, setDraggingProviderId] = useState<string | null>(null);
  const [dragOverProviderId, setDragOverProviderId] = useState<string | null>(null);
  const [dragPreviewProviderIds, setDragPreviewProviderIds] = useState<string[] | null>(null);
  const suppressChannelClickUntilRef = useRef(0);
  const dragPreviewProviderIdsRef = useRef<string[] | null>(null);
  const lastDragReorderTargetProviderIdRef = useRef<string | null>(null);
  const orderedCustomProviders = useMemo(() => {
    if (!dragPreviewProviderIds) {
      return customProviders;
    }

    const providerById = new Map(customProviders.map((provider) => [provider.id, provider] as const));
    const orderedProviders = dragPreviewProviderIds
      .map((providerId) => providerById.get(providerId))
      .filter((provider): provider is typeof customProviders[number] => !!provider);
    const orderedProviderIds = new Set(orderedProviders.map((provider) => provider.id));
    const missingProviders = customProviders.filter((provider) => !orderedProviderIds.has(provider.id));
    return [...orderedProviders, ...missingProviders];
  }, [customProviders, dragPreviewProviderIds]);

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

  const handleChannelClick = (id: string) => {
    if (Date.now() < suppressChannelClickUntilRef.current) {
      return;
    }

    handleSelectProvider(id);
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
    setPendingBaseUrlFocusProviderId(nextId);
  };

  const clearChannelDragState = () => {
    setDraggingProviderId(null);
    setDragOverProviderId(null);
    setDragPreviewProviderIds(null);
    dragPreviewProviderIdsRef.current = null;
    lastDragReorderTargetProviderIdRef.current = null;
  };

  const commitDragPreviewOrder = (providerIds: string[] | null): boolean => {
    if (!providerIds) {
      return false;
    }

    const currentProviderIds = customProviders.map((provider) => provider.id);
    if (areProviderIdsEqual(providerIds, currentProviderIds)) {
      return false;
    }

    reorderCustomProviders(providerIds);
    return true;
  };

  const previewReorderCustomProviders = (draggedProviderId: string, targetProviderId: string) => {
    if (
      draggedProviderId === targetProviderId ||
      lastDragReorderTargetProviderIdRef.current === targetProviderId
    ) {
      return;
    }

    const currentProviderIds =
      dragPreviewProviderIdsRef.current ?? customProviders.map((provider) => provider.id);
    const nextProviderIds = moveProviderIdToTargetIndex(
      currentProviderIds,
      draggedProviderId,
      targetProviderId
    );

    if (nextProviderIds === currentProviderIds) {
      return;
    }

    dragPreviewProviderIdsRef.current = nextProviderIds;
    lastDragReorderTargetProviderIdRef.current = targetProviderId;
    setDragPreviewProviderIds(nextProviderIds);
  };

  const handleChannelDragStart = (providerId: string, event: DragEvent<HTMLDivElement>) => {
    const initialProviderIds = customProviders.map((provider) => provider.id);
    suppressChannelClickUntilRef.current = 0;
    dragPreviewProviderIdsRef.current = initialProviderIds;
    lastDragReorderTargetProviderIdRef.current = null;
    setDraggingProviderId(providerId);
    setDragOverProviderId(null);
    setDragPreviewProviderIds(initialProviderIds);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', providerId);
    setTransparentDragImage(event.dataTransfer);
  };

  const handleChannelDragEnter = (providerId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (draggingProviderId && draggingProviderId !== providerId) {
      setDragOverProviderId(providerId);
      previewReorderCustomProviders(draggingProviderId, providerId);
    }
  };

  const handleChannelDragOver = (providerId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggingProviderId && draggingProviderId !== providerId) {
      setDragOverProviderId(providerId);
      previewReorderCustomProviders(draggingProviderId, providerId);
    }
  };

  const handleChannelDrop = (targetProviderId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const draggedProviderId = draggingProviderId || event.dataTransfer.getData('text/plain');
    const previewProviderIds = dragPreviewProviderIdsRef.current;
    const previewMatchesDropTarget = lastDragReorderTargetProviderIdRef.current === targetProviderId;
    suppressChannelClickUntilRef.current = Date.now() + 250;
    if (!draggedProviderId || !previewProviderIds) {
      clearChannelDragState();
      return;
    }
    const nextProviderIds = previewMatchesDropTarget
      ? previewProviderIds
      : moveProviderIdToTargetIndex(previewProviderIds, draggedProviderId, targetProviderId);
    commitDragPreviewOrder(nextProviderIds);
    clearChannelDragState();
  };

  const handleChannelDragEnd = () => {
    const previewProviderIds = dragPreviewProviderIdsRef.current;
    suppressChannelClickUntilRef.current = Date.now() + 250;
    commitDragPreviewOrder(previewProviderIds);
    clearChannelDragState();
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
      className="h-full min-h-0 bg-[var(--vlaina-color-setting-panel)] text-[var(--vlaina-sidebar-notes-text)]"
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

      <div
        className="h-full min-h-0 overflow-y-auto px-6 py-6 max-[900px]:px-4 max-[900px]:py-5"
        data-settings-scroll-root="ai"
        onWheel={handleScrollableWheel}
      >
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
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,var(--vlaina-size-180px)),1fr))] gap-3">
                  {orderedCustomProviders.map((provider) => (
                    <motion.div
                      key={provider.id}
                      layout
                      transition={{
                        duration: themeMotionTokens.aiChannelPopulatedDuration,
                        ease: themeMotionTokens.standardEase,
                      }}
                    >
                      {(() => {
                      const draft = providerDrafts[provider.id];
                      return (
                        <ChannelObject
                          providerId={provider.id}
                          name={draft?.name ?? provider.name}
                          baseUrl={draft?.apiHost ?? provider.apiHost ?? ''}
                          enabled={provider.enabled ?? true}
                          modelCount={providerModelCounts.get(provider.id) || 0}
                          active={provider.id === selectedProviderId}
                          dragging={provider.id === draggingProviderId}
                          dragOver={provider.id === dragOverProviderId}
                          onClick={() => handleChannelClick(provider.id)}
                          onMiddleClick={() =>
                            handleDeleteCustomProvider(provider.id, draft?.name ?? provider.name)
                          }
                          onToggleEnabled={(nextEnabled) =>
                            handleToggleProviderEnabled(provider.id, nextEnabled)
                          }
                          onDelete={() =>
                            handleDeleteCustomProvider(provider.id, draft?.name ?? provider.name)
                          }
                          onDragStart={(event) => handleChannelDragStart(provider.id, event)}
                          onDragEnter={(event) => handleChannelDragEnter(provider.id, event)}
                          onDragOver={(event) => handleChannelDragOver(provider.id, event)}
                          onDrop={(event) => handleChannelDrop(provider.id, event)}
                          onDragEnd={handleChannelDragEnd}
                        />
                      );
                    })()}
                    </motion.div>
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
              focusBaseUrlOnMount={pendingBaseUrlFocusProviderId === currentProvider.id}
              onBaseUrlAutoFocusComplete={() => setPendingBaseUrlFocusProviderId(null)}
              onDraftChange={(draft) => handleProviderDraftChange(currentProvider.id, draft)}
              onDraftClear={() => handleProviderDraftClear(currentProvider.id)}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

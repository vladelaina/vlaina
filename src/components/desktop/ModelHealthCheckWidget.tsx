import { useEffect, useMemo, useState } from 'react';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { backgroundBenchmarkRunner, type ProviderBenchmarkSnapshot } from '@/lib/ai/modelBenchmark/backgroundRunner';
import { hasElectronDesktopBridge } from '@/lib/desktop/backend';
import { Icon } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function ModelHealthCheckWidget() {
  const isDesktop = hasElectronDesktopBridge();
  const providers = useUnifiedStore((state) => state.data.ai?.providers || []);
  const models = useUnifiedStore((state) => state.data.ai?.models || []);
  const [providerIds, setProviderIds] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, ProviderBenchmarkSnapshot>>({});

  const modelsByProvider = useMemo(() => {
    const next = new Map<string, typeof models>();
    for (const model of models) {
      if (model.enabled === false) continue;
      const providerModels = next.get(model.providerId) || [];
      providerModels.push(model);
      next.set(model.providerId, providerModels);
    }
    return next;
  }, [models]);

  useEffect(() => {
    if (!providerIds.length) return;
    const unsubscribers = providerIds.map((providerId) =>
      backgroundBenchmarkRunner.subscribe(providerId, (snapshot) => {
        setSnapshots((previous) => ({ ...previous, [providerId]: snapshot }));
      })
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [providerIds]);

  const enabledProviders = useMemo(
    () => providers.filter((provider) => provider.enabled !== false && (modelsByProvider.get(provider.id)?.length || 0) > 0),
    [modelsByProvider, providers]
  );
  const isRunning = Object.values(snapshots).some((snapshot) => snapshot.isRunning);
  const failedModelNames = useMemo(() => {
    const names = new Set<string>();
    const modelById = new Map(models.map((model) => [model.id, model]));
    for (const snapshot of Object.values(snapshots)) {
      for (const [modelId, item] of Object.entries(snapshot.items)) {
        if (item.status !== 'error') continue;
        const model = modelById.get(modelId);
        names.add(model?.name || model?.apiModelId || modelId);
      }
    }
    return [...names];
  }, [models, snapshots]);
  const progress = useMemo(() => {
    const totals = Object.values(snapshots).reduce(
      (result, snapshot) => ({ completed: result.completed + snapshot.completed, total: result.total + snapshot.total }),
      { completed: 0, total: 0 },
    );
    return totals.total > 0 ? `${totals.completed}/${totals.total}` : '';
  }, [snapshots]);

  if (!isDesktop) return null;

  const runAllTests = () => {
    if (isRunning) {
      providerIds.forEach((providerId) => backgroundBenchmarkRunner.stop(providerId));
      return;
    }

    const runnableProviders = enabledProviders.filter((provider) => (modelsByProvider.get(provider.id)?.length || 0) > 0);
    if (!runnableProviders.length) return;

    setSnapshots({});
    setProviderIds(runnableProviders.map((provider) => provider.id));
    for (const provider of runnableProviders) {
      const providerModels = modelsByProvider.get(provider.id) || [];
      backgroundBenchmarkRunner.start(provider, providerModels);
    }
  };

  return (
    <div className="pointer-events-none flex max-w-[var(--vlaina-width-workspace-switcher)] flex-col items-end gap-2">
      {failedModelNames.length > 0 && !isRunning ? (
        <div className="pointer-events-auto w-full rounded-[var(--vlaina-radius-16px)] border border-[var(--vlaina-color-status-danger-bg)] bg-[var(--vlaina-color-floating-surface)] px-3 py-2 text-[var(--vlaina-font-xs)] text-[var(--vlaina-color-status-danger-fg)] shadow-[var(--vlaina-shadow-floating-panel)]">
          <div className="mb-1 font-semibold">{`${translate('settings.ai.failed')} ${failedModelNames.length} ${translate('settings.ai.models')}`}</div>
          <div className="break-words">{failedModelNames.join(', ')}</div>
        </div>
      ) : null}
      <button
        type="button"
        className={cn(
          'pointer-events-auto inline-flex h-10 items-center gap-2 rounded-full border border-[var(--vlaina-border)] bg-[var(--vlaina-color-floating-surface)] px-4 text-[var(--vlaina-font-xs)] font-semibold text-[var(--vlaina-sidebar-notes-text)] shadow-[var(--vlaina-shadow-floating-panel)] transition-colors hover:bg-[var(--vlaina-hover)] disabled:cursor-not-allowed disabled:opacity-[var(--vlaina-opacity-50)]',
          isRunning && 'text-[var(--vlaina-color-status-danger-fg)]',
        )}
        aria-label={translate('settings.ai.benchmarkAll')}
        disabled={enabledProviders.length === 0}
        onClick={runAllTests}
      >
        <Icon name={isRunning ? 'common.close' : 'misc.activity'} size="xs" />
        <span>{isRunning ? translate('settings.ai.stopBenchmark') : translate('settings.ai.benchmarkAll')}</span>
        {progress ? <span className="text-[var(--vlaina-sidebar-notes-text-soft)]">{progress}</span> : null}
      </button>
    </div>
  );
}

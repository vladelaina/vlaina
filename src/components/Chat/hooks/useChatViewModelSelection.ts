import { useEffect, useMemo, useState } from 'react';
import { actions as aiActions } from '@/stores/useAIStore';
import { isManagedProviderId } from '@/lib/ai/managedService';
import type { ManagedBudgetStatus } from '@/lib/ai/managedService';
import { isManagedBudgetExhausted } from '@/lib/ai/managedQuota';
import type { AIModel, Provider } from '@/lib/ai/types';

export function useChatViewModelSelection(args: {
  managedBudget: ManagedBudgetStatus | null | undefined;
  models: AIModel[];
  providers: Provider[];
  selectedModelId: string | null;
}) {
  const { managedBudget, models, providers, selectedModelId } = args;
  const selectedModel = useMemo(() => {
    if (!selectedModelId) {
      return undefined;
    }

    const model = models.find((item) => item.id === selectedModelId);
    if (!model) {
      return undefined;
    }

    const provider = providers.find((item) => item.id === model.providerId);
    return model.enabled === false || provider?.enabled === false ? undefined : model;
  }, [models, providers, selectedModelId]);
  const isSelectedManagedModel = Boolean(selectedModel && isManagedProviderId(selectedModel.providerId));
  const [hasStickyManagedQuotaExhaustion, setHasStickyManagedQuotaExhaustion] = useState(false);

  useEffect(() => {
    if (!isSelectedManagedModel) {
      setHasStickyManagedQuotaExhaustion(false);
      return;
    }
    if (isManagedBudgetExhausted(managedBudget)) {
      setHasStickyManagedQuotaExhaustion(true);
      return;
    }
    if (
      managedBudget &&
      typeof managedBudget.remainingPercent === 'number' &&
      Number.isFinite(managedBudget.remainingPercent) &&
      managedBudget.remainingPercent > 0
    ) {
      setHasStickyManagedQuotaExhaustion(false);
    }
  }, [isSelectedManagedModel, managedBudget]);

  const firstEnabledModel = useMemo(() => {
    const enabledProviderIds = new Set(
      providers.filter((provider) => provider.enabled !== false).map((provider) => provider.id)
    );
    return models.find((model) => model.enabled && enabledProviderIds.has(model.providerId));
  }, [models, providers]);

  useEffect(() => {
      if (!selectedModel && firstEnabledModel) {
          aiActions.selectModel(firstEnabledModel.id);
      }
  }, [firstEnabledModel, selectedModel]);

  return {
    isSelectedManagedQuotaExhausted: Boolean(
      isSelectedManagedModel &&
      (isManagedBudgetExhausted(managedBudget) || hasStickyManagedQuotaExhaustion)
    ),
    selectedModel,
  };
}

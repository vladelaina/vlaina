import { useUIStore } from '@/stores/uiSlice';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { managedProviderSync } from '@/stores/ai/providerActions';
import type { E2EBridge } from './syncE2EBridgeTypes';

type UIBridgeActions = Pick<
  E2EBridge,
  | 'getUIState'
  | 'setUIPreferences'
  | 'getManagedBudgetState'
  | 'applyManagedBudgetSnapshot'
  | 'clearManagedBudget'
>;

export function createSyncE2EUIActions(): UIBridgeActions {
  return {
    getUIState: () => {
      const {
        fontSize,
        languagePreference,
        sidebarWidth,
        imageStorageMode,
        imageSubfolderName,
        imageNotesRootSubfolderName,
        imageFilenameFormat,
        notesChatPanelCollapsed,
      } = useUIStore.getState();
      return {
        fontSize,
        languagePreference,
        sidebarWidth,
        imageStorageMode,
        imageSubfolderName,
        imageNotesRootSubfolderName,
        imageFilenameFormat,
        notesChatPanelCollapsed,
        colorMode: useUnifiedStore.getState().data.settings.ui?.colorMode ?? 'system',
      };
    },
    setUIPreferences: async (input) => {
      const store = useUIStore.getState();
      if (typeof input.fontSize === 'number') {
        store.setFontSize(input.fontSize);
      }
      if (input.languagePreference) {
        store.setLanguagePreference(input.languagePreference as never);
      }
      if (typeof input.sidebarWidth === 'number') {
        store.setSidebarWidth(input.sidebarWidth);
      }
      if (input.imageStorageMode) {
        store.setImageStorageMode(input.imageStorageMode);
      }
      if (typeof input.imageSubfolderName === 'string') {
        store.setImageSubfolderName(input.imageSubfolderName);
      }
      if (typeof input.notesChatPanelCollapsed === 'boolean') {
        store.setNotesChatPanelCollapsed(input.notesChatPanelCollapsed);
      }
      if (input.colorMode) {
        useUnifiedStore.getState().setColorMode(input.colorMode);
      }
    },
    getManagedBudgetState: () => {
      const { budget, lastBudgetSyncAt, budgetError, isRefreshingBudget } = useManagedAIStore.getState();
      return { budget, lastBudgetSyncAt, budgetError, isRefreshingBudget };
    },
    applyManagedBudgetSnapshot: async (budget) => {
      await managedProviderSync.syncFromStartup({ refreshBudget: false });
      useManagedAIStore.getState().applyBudgetSnapshot(budget);
    },
    clearManagedBudget: async () => {
      useManagedAIStore.getState().clearBudget();
    },
  };
}

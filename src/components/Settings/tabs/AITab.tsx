import { useState, useEffect, useMemo, useRef } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { ProviderDetail } from './ai/ProviderDetail';
import { AIBehaviorSettings } from './ai/AIBehaviorSettings';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { MANAGED_PROVIDER_ID } from '@/lib/ai/managedService';

export function AITab() {
  const { providers, addProvider } = useAIStore();
  const customProviders = useMemo(
    () => providers.filter((provider) => provider.id !== MANAGED_PROVIDER_ID),
    [providers]
  );
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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
    const handleOutsideClick = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const currentProvider = selectedProviderId
    ? customProviders.find((provider) => provider.id === selectedProviderId)
    : undefined;

  const handleSelectProvider = (id: string) => {
    setSelectedProviderId(id);
    setIsDropdownOpen(false);
  };

  const handleAddCustomProvider = () => {
    const customIndex = customProviders.length + 1;
    const nextId = addProvider({
      name: `Custom Channel ${customIndex}`,
      type: 'newapi',
      apiHost: '',
      apiKey: '',
      enabled: true,
    });
    setSelectedProviderId(nextId);
    setIsDropdownOpen(false);
  };

  return (
    <div className="h-full bg-white dark:bg-[#1E1E1E]">
      <div className="h-full px-6 py-6 overflow-y-auto">
        <AIBehaviorSettings />

        <div className="max-w-5xl mx-auto mb-4 flex items-center gap-2">
          <div ref={dropdownRef} className="relative flex-1">
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-gray-500/20 flex items-center justify-between"
            >
              <span className="truncate">{currentProvider?.name || 'Select Channel'}</span>
              <Icon
                name="nav.chevronDown"
                size="sm"
                className={cn(
                  'text-gray-400 transition-transform',
                  isDropdownOpen && 'rotate-180'
                )}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1E1E1E] shadow-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto p-1">
                  {customProviders.map((provider) => {
                    const isSelected = provider.id === selectedProviderId;
                    return (
                      <div
                        key={provider.id}
                        className={cn(
                          'flex items-center gap-1 rounded-md',
                          isSelected && 'bg-gray-100 dark:bg-white/10'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectProvider(provider.id)}
                          className="flex-1 h-8 px-2.5 text-left text-sm text-gray-800 dark:text-gray-100 truncate"
                        >
                          {provider.name}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddCustomProvider}
            className="h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-white/10"
          >
            Add Channel
          </button>
        </div>

        <ProviderDetail
          provider={currentProvider}
        />
      </div>
    </div>
  );
}

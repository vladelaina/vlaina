import { useState, useEffect, useRef } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { ProviderDetail } from './ai/ProviderDetail';
import { AIBehaviorSettings } from './ai/AIBehaviorSettings';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export function AITab() {
  const { providers, addProvider, deleteProvider } = useAIStore();
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const hasAutoCreatedForEmpty = useRef(false);

  useEffect(() => {
    if (providers.length === 0) {
      if (hasAutoCreatedForEmpty.current) return;
      hasAutoCreatedForEmpty.current = true;
      const id = addProvider({
        name: 'New Channel',
        type: 'newapi',
        apiHost: '',
        apiKey: '',
        enabled: true
      });
      setSelectedProviderId(id);
      return;
    }

    hasAutoCreatedForEmpty.current = false;

    if (!selectedProviderId) {
      setSelectedProviderId(providers[0].id);
    } else {
      const exists = providers.some(p => p.id === selectedProviderId);
      if (!exists) {
        setSelectedProviderId(providers[0].id);
      }
    }
  }, [providers, selectedProviderId, addProvider]);

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
    ? providers.find(p => p.id === selectedProviderId)
    : undefined;

  const handleAddCustomProvider = () => {
    const name = `New Channel ${providers.length + 1}`;
    const id = addProvider({
      name,
      type: 'newapi',
      apiHost: '',
      apiKey: '',
      enabled: true
    });
    setSelectedProviderId(id);
    setIsDropdownOpen(false);
  };

  const handleSelectProvider = (id: string) => {
    setSelectedProviderId(id);
    setIsDropdownOpen(false);
  };

  const handleDeleteProviderDirect = (id: string) => {
    const remaining = providers.filter((provider) => provider.id !== id);
    deleteProvider(id);
    if (selectedProviderId === id) {
      setSelectedProviderId(remaining[0]?.id ?? null);
    }
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
                  {providers.map((provider) => {
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
                        <button
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleDeleteProviderDirect(provider.id);
                          }}
                          className="h-7 w-7 mr-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center"
                          title="Delete Channel"
                        >
                          <Icon name="common.close" size="xs" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleAddCustomProvider}
            title="Add Channel"
            className="h-10 w-10 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center justify-center"
          >
            <Icon name="common.add" size="sm" />
          </button>
        </div>

        <ProviderDetail
          provider={currentProvider}
        />
      </div>
    </div>
  );
}

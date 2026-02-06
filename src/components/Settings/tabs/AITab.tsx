import { useState, useEffect } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { SUPPORTED_PROVIDERS } from './ai/constants';
import { ProviderDetail } from './ai/ProviderDetail';

export function AITab() {
  const { providers, addProvider } = useAIStore();
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // Initialize selection if possible
  useEffect(() => {
      if (!selectedProviderId && providers.length > 0) {
          setSelectedProviderId(providers[0].id);
      }
  }, [providers, selectedProviderId]);

  // Resolve current provider object
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
  };

  const handleSelectProvider = (id: string) => {
      setSelectedProviderId(id);
  };

  return (
    <div className="flex h-full bg-white dark:bg-[#1E1E1E]">
      {/* Main Content - Full Width */}
      <div className="flex-1 min-w-0 bg-white dark:bg-[#1E1E1E]">
        <div className="h-full px-8 py-8 overflow-y-auto">
            <ProviderDetail 
                provider={currentProvider}
                allProviders={providers}
                onSelectProvider={handleSelectProvider}
                onAddProvider={handleAddCustomProvider}
            />
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { ProviderDetail } from './ai/ProviderDetail';
import { ProviderSidebar } from './ai/components/ProviderSidebar';

export function AITab() {
  const { providers, addProvider } = useAIStore();
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  // Initialize selection or create default
  useEffect(() => {
      if (providers.length === 0) {
          // No providers? Create one immediately!
          // Use a ref to prevent double-firing in Strict Mode if necessary, though length check is robust
          if (!hasInitialized.current) {
              hasInitialized.current = true;
              const id = addProvider({
                  name: 'New Channel',
                  type: 'newapi',
                  apiHost: '',
                  apiKey: '',
                  enabled: true
              });
              setSelectedProviderId(id);
          }
      } else if (!selectedProviderId) {
          // Have providers but none selected? Select the first one.
          setSelectedProviderId(providers[0].id);
      } else {
          // Have selectedId, verify it exists (e.g. after deletion)
          const exists = providers.some(p => p.id === selectedProviderId);
          if (!exists) {
              setSelectedProviderId(providers[0].id);
          }
      }
  }, [providers, selectedProviderId, addProvider]);

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
      <ProviderSidebar
        allProviders={providers}
        selectedId={selectedProviderId || ''}
        onSelect={handleSelectProvider}
        onAddCustom={handleAddCustomProvider}
      />

      <div className="flex-1 min-w-0 bg-white dark:bg-[#1E1E1E]">
        <div className="h-full px-6 py-6 overflow-y-auto">
          <ProviderDetail
            provider={currentProvider}
          />
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { SUPPORTED_PROVIDERS, ProviderConfig } from './ai/constants';
import { ProviderDetail } from './ai/ProviderDetail';
import { ProviderSidebar } from './ai/components/ProviderSidebar';

export function AITab() {
  const { providers, addProvider } = useAIStore();
  const [selectedProviderId, setSelectedProviderId] = useState<string>(SUPPORTED_PROVIDERS[0].id);

  // Identify "Custom" providers (those in store but NOT matching any supported template name)
  const supportedNames = new Set(SUPPORTED_PROVIDERS.map(p => p.name));
  const customProviders = providers.filter(p => !supportedNames.has(p.name));

  // Resolve Selection
  let resolvedConfig: ProviderConfig | undefined;
  let resolvedProvider: any | undefined;

  const template = SUPPORTED_PROVIDERS.find(p => p.id === selectedProviderId);
  if (template) {
    resolvedConfig = template;
    resolvedProvider = providers.find(p => p.name === template.name);
  } else {
    const customInstance = customProviders.find(p => p.id === selectedProviderId);
    if (customInstance) {
      resolvedProvider = customInstance;
      resolvedConfig = {
        id: customInstance.id,
        name: customInstance.name,
        icon: customInstance.icon || SUPPORTED_PROVIDERS[0].icon, 
        defaultBaseUrl: '',
        description: 'Custom OpenAI-compatible service'
      };
    } else {
        // Fallback
        resolvedConfig = SUPPORTED_PROVIDERS[0];
        resolvedProvider = providers.find(p => p.name === resolvedConfig!.name);
    }
  }

  const handleAddCustomProvider = () => {
      const name = `New Service ${customProviders.length + 1}`;
      const id = addProvider({
          name,
          type: 'newapi',
          apiHost: '',
          apiKey: '',
          enabled: true
      });
      setSelectedProviderId(id);
  };

  return (
    <div className="flex h-full bg-white dark:bg-[#1E1E1E]">
      <ProviderSidebar 
        allProviders={providers}
        supportedConfigs={SUPPORTED_PROVIDERS}
        selectedId={selectedProviderId}
        onSelect={setSelectedProviderId}
        onAddCustom={handleAddCustomProvider}
      />

      {/* Main Content */}
      <div className="flex-1 min-w-0 bg-white dark:bg-[#1E1E1E]">
        <div className="h-full px-8 py-8 overflow-y-auto">
            {resolvedConfig && (
                <ProviderDetail 
                    key={selectedProviderId} 
                    config={resolvedConfig} 
                    provider={resolvedProvider} 
                />
            )}
        </div>
      </div>
    </div>
  );
}
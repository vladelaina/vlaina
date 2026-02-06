import { useState } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { SUPPORTED_PROVIDERS, ProviderConfig } from './ai/constants';
import { ProviderDetail } from './ai/ProviderDetail';
import { cn } from '@/lib/utils';
import { MdCheckCircle, MdSearch } from 'react-icons/md';

export function AITab() {
  const { providers } = useAIStore();
  const [selectedProviderId, setSelectedProviderId] = useState<string>(SUPPORTED_PROVIDERS[0].id);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedConfig = SUPPORTED_PROVIDERS.find(p => p.id === selectedProviderId) || SUPPORTED_PROVIDERS[0];
  
  // Find the stored provider data that matches the selected config
  const storedProvider = providers.find(p => p.name === selectedConfig.name);

  // Filter providers based on search query
  const filteredProviders = SUPPORTED_PROVIDERS.filter(provider => 
    provider.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full bg-white dark:bg-[#1E1E1E]">
      {/* Sidebar List */}
      <div className="w-[240px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1C1C1C] flex flex-col">
        {/* Search Bar */}
        <div className="p-3 pb-2">
          <div className="relative">
            <MdSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search providers..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Provider List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-none">
          {filteredProviders.length === 0 ? (
             <div className="text-center py-8 text-xs text-gray-400">
                No providers found
             </div>
          ) : (
            filteredProviders.map((provider) => {
              const isConfigured = providers.some(p => p.name === provider.name && p.apiKey);
              const isSelected = selectedProviderId === provider.id;

              return (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProviderId(provider.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                    isSelected
                      ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                      : "text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                >
                  <div className="w-6 h-6 rounded-md bg-white dark:bg-gray-800 p-0.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img src={provider.icon} alt={provider.name} className="w-full h-full object-contain" />
                  </div>
                  <span className="flex-1 text-left truncate">{provider.name}</span>
                  {isConfigured && (
                    <MdCheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 bg-white dark:bg-[#1E1E1E]">
        <div className="h-full px-8 py-8 overflow-y-auto">
            <ProviderDetail 
                key={selectedProviderId} // Force re-mount on selection change to reset internal state
                config={selectedConfig} 
                provider={storedProvider} 
            />
        </div>
      </div>
    </div>
  );
}
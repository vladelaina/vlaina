import { useState } from 'react';
import { MdSearch, MdAdd, MdCheckCircle } from 'react-icons/md';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/common/AppIcon';
import { Provider } from '@/lib/ai/types';
import { ProviderConfig, SUPPORTED_PROVIDERS } from '../ai/constants';

interface ProviderSidebarProps {
  allProviders: Provider[];
  supportedConfigs: ProviderConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddCustom: () => void;
}

export function ProviderSidebar({
  allProviders,
  supportedConfigs,
  selectedId,
  onSelect,
  onAddCustom
}: ProviderSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Identify "Custom" providers (those in store but NOT matching any supported template name)
  const supportedNames = new Set(supportedConfigs.map(p => p.name));
  const customProviders = allProviders.filter(p => !supportedNames.has(p.name));

  // Filter lists
  const filteredSupported = supportedConfigs.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredCustom = customProviders.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
      <div className="w-[240px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1C1C1C] flex flex-col">
        {/* Search Bar */}
        <div className="p-3 pb-2 flex items-center gap-2">
          <div className="relative flex-1">
            <MdSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            />
          </div>
          <button
            onClick={onAddCustom}
            title="Add Custom Provider"
            className="p-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 transition-all shadow-sm flex-shrink-0"
          >
            <MdAdd className="w-5 h-5" />
          </button>
        </div>

        {/* Provider List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-none">
          {/* Custom Providers Section */}
          {filteredCustom.length > 0 && (
              <div className="mb-4">
                  <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Custom Channels
                  </div>
                  {filteredCustom.map(provider => {
                      const isSelected = selectedId === provider.id;
                      return (
                        <button
                          key={provider.id}
                          onClick={() => onSelect(provider.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                            isSelected
                              ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                              : "text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5"
                          )}
                        >
                          <div className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0">
                            <AppIcon icon={provider.icon || SUPPORTED_PROVIDERS[0].icon} size={18} />
                          </div>
                          <span className="flex-1 text-left truncate">{provider.name}</span>
                          <MdCheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        </button>
                      );
                  })}
              </div>
          )}

          {/* Supported Providers Section */}
          <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Standard
          </div>
          {(filteredSupported.length > 0) ? (
            filteredSupported.map((provider) => {
              const isConfigured = allProviders.some(p => p.name === provider.name && p.apiKey);
              const isSelected = selectedId === provider.id;

              return (
                <button
                  key={provider.id}
                  onClick={() => onSelect(provider.id)}
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
          ) : filteredCustom.length === 0 && (
             <div className="text-center py-8 text-xs text-gray-400">
                No providers found
             </div>
          )}
        </div>
      </div>
  );
}

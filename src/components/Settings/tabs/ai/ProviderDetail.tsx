import { useState, useEffect } from 'react';
import { MdCheck, MdSave, MdAdd, MdDelete, MdRefresh, MdContentCopy, MdCloudDownload, MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';
import { useAIStore } from '@/stores/useAIStore';
import { ProviderConfig, SUPPORTED_PROVIDERS } from './constants';
import { newAPIClient } from '@/lib/ai/providers/newapi';
import { cn } from '@/lib/utils';
import { generateModelGroup } from '@/lib/ai/utils';
import { Provider, AIModel } from '@/lib/ai/types';
import { IconSelector } from '@/components/common/IconSelector';
import { AppIcon } from '@/components/common/AppIcon';
import { ModelListItem } from './components/ModelListItem';
import { AddModelModal } from './components/AddModelModal';

interface ProviderDetailProps {
  config: ProviderConfig;
  provider?: Provider; // Existing provider data from store
}

export function ProviderDetail({ config, provider: initialProvider }: ProviderDetailProps) {
  const { 
    addProvider, 
    updateProvider, 
    deleteProvider,
    models,
    addModel,
    deleteModel,
    updateModel
  } = useAIStore();

  const [name, setName] = useState(initialProvider?.name || config.name);
  const [icon, setIcon] = useState(initialProvider?.icon || config.icon);
  const [apiKey, setApiKey] = useState(initialProvider?.apiKey || '');
  const [apiHost, setApiHost] = useState(initialProvider?.apiHost || config.defaultBaseUrl);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<'success' | 'error' | null>(null);
  
  // Icon Preview
  const [previewIcon, setPreviewIcon] = useState<string | null>(null);
  
  // Model list management
  const [isAddingModel, setIsAddingModel] = useState(false);
  
  // Dynamic Fetching
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState<string | null>(null);

  const providerModels = initialProvider 
    ? models.filter(m => m.providerId === initialProvider.id)
    : [];

  const isCustomInstance = initialProvider && config.id === initialProvider.id;

  // Update local state when provider changes
  useEffect(() => {
    setName(initialProvider?.name || config.name);
    setIcon(initialProvider?.icon || config.icon);
    setApiKey(initialProvider?.apiKey || '');
    setApiHost(initialProvider?.apiHost || config.defaultBaseUrl);
    setCheckResult(null);
    setFetchedModels([]);
    setCollapsedGroups(new Set());
    setFetchError(null);
    setIsAddingModel(false);
    setPreviewIcon(null);
  }, [initialProvider, config]);

  const handleSave = () => {
    if (initialProvider) {
      updateProvider(initialProvider.id, {
        name,
        icon,
        apiKey,
        apiHost,
        updatedAt: Date.now()
      });
      setCheckResult('success');
      setTimeout(() => setCheckResult(null), 2000);
    } else {
      // Create new
      if (!apiKey.trim()) return;
      addProvider({
        name: config.name,
        icon: config.icon,
        type: 'newapi', 
        apiHost,
        apiKey,
        enabled: true
      });
    }
  };

  const handleDeleteProvider = () => {
      if (initialProvider && confirm('Are you sure you want to delete this service?')) {
          deleteProvider(initialProvider.id);
      }
  };

  const handleCheckConnection = async () => {
    if (!apiKey.trim()) return;
    setIsChecking(true);
    setCheckResult(null);

    try {
      const tempProvider: Provider = {
        id: 'temp',
        name: name,
        type: 'newapi',
        apiHost,
        apiKey,
        enabled: true,
        createdAt: 0,
        updatedAt: 0
      };

      const success = await newAPIClient.testConnection(tempProvider);
      setCheckResult(success ? 'success' : 'error');
    } catch (e) {
      setCheckResult('error');
    } finally {
      setIsChecking(false);
    }
  };

  const handleFetchModels = async () => {
    if (!apiKey.trim()) return;
    setIsFetchingModels(true);
    setFetchError(null);
    setFetchedModels([]);

    try {
      const tempProvider: Provider = {
        id: initialProvider?.id || 'temp',
        name: name,
        type: 'newapi',
        apiHost,
        apiKey,
        enabled: true,
        createdAt: 0,
        updatedAt: 0
      };

      const modelsList = await newAPIClient.getModels(tempProvider);
      if (modelsList.length === 0) {
        setFetchError('No models found or API returned empty list.');
      } else {
        setFetchedModels(modelsList);
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch models');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleAddModel = (id: string, nameVal?: string) => {
    if (!id.trim()) return;
    
    // Auto-save provider if it doesn't exist
    let currentProviderId = initialProvider?.id;
    if (!currentProviderId) {
        if (!apiKey.trim()) return;
        currentProviderId = addProvider({
            name,
            icon,
            type: 'newapi',
            apiHost,
            apiKey,
            enabled: true
        });
    }
    
    const existingModels = models.filter(m => m.providerId === currentProviderId);
    if (existingModels.some(m => m.id === id.trim())) return;

    addModel({
      id: id.trim(),
      name: nameVal?.trim() || id.trim(),
      providerId: currentProviderId,
      enabled: true
    });
    
    setIsAddingModel(false);
  };

  const toggleGroup = (group: string) => {
      const newSet = new Set(collapsedGroups);
      if (newSet.has(group)) newSet.delete(group);
      else newSet.add(group);
      setCollapsedGroups(newSet);
  };

  const groupModelsList = (modelIds: string[]) => {
      return modelIds.reduce((acc, id) => {
          const group = generateModelGroup(id);
          if (!acc[group]) acc[group] = [];
          acc[group].push(id);
          return acc;
      }, {} as Record<string, string[]>);
  };

  const displayIcon = previewIcon || icon || 'cube';

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 pb-6 border-b border-gray-100 dark:border-gray-800">
          <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
              isCustomInstance ? "bg-transparent" : "overflow-hidden bg-gray-50 dark:bg-gray-800 p-2"
          )}>
            {isCustomInstance ? (
                 <IconSelector 
                    value={icon} 
                    onChange={(newIcon) => {
                        setIcon(newIcon);
                        if (initialProvider) {
                            updateProvider(initialProvider.id, { icon: newIcon, updatedAt: Date.now() });
                        }
                    }} 
                    onHover={setPreviewIcon}
                    compact 
                    trigger={
                        <button className="w-12 h-12 flex items-center justify-center hover:opacity-80 transition-opacity" title="Change Icon">
                            <AppIcon icon={displayIcon} size={40} className="object-contain" />
                        </button>
                    }
                 />
             ) : (
                <img src={config.icon} alt={config.name} className="w-full h-full object-contain" />
             )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {config.description || `Configure ${config.name} settings`}
            </p>
          </div>
          {isCustomInstance && (
              <button
                  onClick={handleDeleteProvider}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete Service"
              >
                  <MdDelete className="w-5 h-5" />
              </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-6 space-y-8">
          {/* Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              Configuration
            </h3>
            
            <div className="grid gap-4">
              {isCustomInstance && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Display Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Base URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={apiHost}
                    onChange={(e) => setApiHost(e.target.value)}
                    placeholder="https://api.example.com"
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  {config.defaultBaseUrl !== apiHost && (
                      <button 
                          onClick={() => setApiHost(config.defaultBaseUrl)}
                          title="Reset to default"
                          className="px-3 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                      >
                          <MdRefresh />
                      </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <button
                onClick={handleSave}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                )}
              >
                <MdSave className="w-4 h-4" />
                Save
              </button>
              
              <button
                onClick={handleCheckConnection}
                disabled={isChecking || !apiKey}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                  checkResult === 'success' 
                    ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                    : checkResult === 'error'
                      ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
              >
                {isChecking ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : checkResult === 'success' ? (
                  <MdCheck className="w-4 h-4" />
                ) : (
                  <MdRefresh className="w-4 h-4" />
                )}
                {isChecking ? 'Checking...' : checkResult === 'success' ? 'Connected' : checkResult === 'error' ? 'Failed' : 'Check'}
              </button>

              <button
                onClick={handleFetchModels}
                disabled={isFetchingModels || !apiKey}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                  "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
              >
                {isFetchingModels ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <MdCloudDownload className="w-4 h-4" />
                )}
                Fetch Models
              </button>
            </div>

            {/* Discovered Models Result Area */}
            {(fetchedModels.length > 0 || fetchError) && (
              <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                  {fetchError ? (
                      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                          <span className="font-bold">Error:</span> {fetchError}
                      </div>
                  ) : (
                      <div className="space-y-2">
                          <div className="flex items-center justify-between px-1 mb-2">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                  <MdCloudDownload className="w-4 h-4 text-blue-500" />
                                  Discovered Models ({fetchedModels.length})
                              </h4>
                              <button onClick={() => setFetchedModels([])} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
                          </div>
                          
                          <div className="max-h-[320px] overflow-y-auto pr-2 scrollbar-thin space-y-2">
                              {Object.entries(groupModelsList(fetchedModels)).sort().map(([group, groupModels]) => {
                                  const isCollapsed = collapsedGroups.has(`fetched-${group}`);
                                  return (
                                      <div key={group} className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
                                          <button 
                                              onClick={() => toggleGroup(`fetched-${group}`)}
                                              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                          >
                                              <div className="flex items-center gap-2">
                                                  {isCollapsed ? <MdKeyboardArrowRight size={16} /> : <MdKeyboardArrowDown size={16} />}
                                                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{group}</span>
                                                  <span className="text-[10px] text-gray-400 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">{groupModels.length}</span>
                                              </div>
                                          </button>
                                          {!isCollapsed && (
                                              <div className="flex flex-col gap-1 p-2 bg-white dark:bg-gray-800/50">
                                                  {groupModels.map(modelId => (
                                                      <ModelListItem 
                                                        key={modelId} 
                                                        modelId={modelId} 
                                                        isAdded={providerModels.some(m => m.id === modelId)} 
                                                        onAdd={() => handleAddModel(modelId)}
                                                        defaultIcon={config.icon}
                                                      />
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  )}
              </div>
            )}
          </div>

          {/* Added Models List */}
          <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-800">
             <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
               My Models
             </h3>

             <div className="space-y-2 pb-4">
                {providerModels.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-800 text-sm">
                        No models configured
                    </div>
                ) : (
                    Object.entries(groupModelsList(providerModels.map(m => m.id))).sort().map(([group, groupModels]) => {
                        const isCollapsed = collapsedGroups.has(`added-${group}`);
                        return (
                            <div key={group} className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden mb-2">
                                <button 
                                    onClick={() => toggleGroup(`added-${group}`)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {isCollapsed ? <MdKeyboardArrowRight size={16} /> : <MdKeyboardArrowDown size={16} />}
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{group}</span>
                                    </div>
                                </button>
                                {!isCollapsed && (
                                    <div className="flex flex-col gap-1 p-2">
                                        {groupModels.map(modelId => (
                                            <ModelListItem 
                                                key={modelId} 
                                                modelId={modelId} 
                                                isAdded={true} 
                                                onRemove={() => deleteModel(modelId)}
                                                defaultIcon={config.icon}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
             </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-[#1E1E1E]/80 backdrop-blur-sm">
           <button
               onClick={() => setIsAddingModel(true)}
               className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium text-sm shadow-sm"
           >
               <MdAdd className="w-4 h-4" />
               Add Custom Model
           </button>
        </div>
      </div>

      <AddModelModal 
        isOpen={isAddingModel}
        onClose={() => setIsAddingModel(false)}
        onAdd={handleAddModel}
      />
    </>
  );
}
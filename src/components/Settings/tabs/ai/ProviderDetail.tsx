import { useState, useEffect } from 'react';
import { MdCheck, MdSave, MdAdd, MdDelete, MdCloudDownload, MdKeyboardArrowDown, MdKeyboardArrowRight, MdUnfoldMore } from 'react-icons/md';
import { useAIStore } from '@/stores/useAIStore';
import { newAPIClient } from '@/lib/ai/providers/newapi';
import { cn } from '@/lib/utils';
import { Provider } from '@/lib/ai/types';
import { AppIcon } from '@/components/common/AppIcon';
import { ModelListItem } from './components/ModelListItem';
import { AddModelModal } from './components/AddModelModal';
import { generateModelGroup } from '@/lib/ai/utils';
import { IconSelector } from '@/components/common/IconSelector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProviderDetailProps {
  provider: Provider | undefined;
  allProviders: Provider[];
  onSelectProvider: (id: string) => void;
  onAddProvider: () => void;
}

export function ProviderDetail({ provider: initialProvider, allProviders, onSelectProvider, onAddProvider }: ProviderDetailProps) {
  const { 
    updateProvider, 
    deleteProvider,
    models,
    addModel,
    deleteModel
  } = useAIStore();

  // State
  const [name, setName] = useState(initialProvider?.name || '');
  const [apiKey, setApiKey] = useState(initialProvider?.apiKey || '');
  const [apiHost, setApiHost] = useState(initialProvider?.apiHost || '');
  
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<'success' | 'error' | null>(null);
  
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [previewIcon, setPreviewIcon] = useState<string | null>(null);

  const providerModels = initialProvider 
    ? models.filter(m => m.providerId === initialProvider.id)
    : [];

  // Update local state when provider changes
  useEffect(() => {
    if (initialProvider) {
        setName(initialProvider.name);
        setApiKey(initialProvider.apiKey || '');
        setApiHost(initialProvider.apiHost || '');
    } else {
        setName('');
        setApiKey('');
        setApiHost('');
    }
    setCheckResult(null);
    setFetchedModels([]);
    setCollapsedGroups(new Set());
    setFetchError(null);
    setIsAddingModel(false);
    setPreviewIcon(null);
  }, [initialProvider]);

  const handleSave = () => {
    if (initialProvider) {
      updateProvider(initialProvider.id, { name, apiKey, apiHost, updatedAt: Date.now() });
      setCheckResult('success');
      setTimeout(() => setCheckResult(null), 2000);
    } 
  };

  const handleDeleteProvider = () => {
      if (initialProvider && confirm('Are you sure you want to delete this channel?')) {
          deleteProvider(initialProvider.id);
      }
  };

  const handleCheckConnection = async () => {
    if (!apiKey.trim()) return;
    setIsChecking(true);
    setCheckResult(null);

    try {
      const tempProvider: Provider = { id: initialProvider?.id || 'temp', name, type: 'newapi', apiHost, apiKey, enabled: true, createdAt: 0, updatedAt: 0 };
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
      const tempProvider: Provider = { id: initialProvider?.id || 'temp', name, type: 'newapi', apiHost, apiKey, enabled: true, createdAt: 0, updatedAt: 0 };
      const modelsList = await newAPIClient.getModels(tempProvider);
      if (modelsList.length === 0) setFetchError('No models found.');
      else setFetchedModels(modelsList);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch models');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleAddModel = (id: string, nameVal?: string) => {
    if (!id.trim() || !initialProvider) return;
    
    const existingModels = models.filter(m => m.providerId === initialProvider.id);
    if (existingModels.some(m => m.id === id.trim())) return;

    addModel({
      id: id.trim(),
      name: nameVal?.trim() || id.trim(),
      providerId: initialProvider.id,
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

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Header with Channel Switcher and Icon Selector */}
        <div className="pb-6 border-b border-gray-100 dark:border-gray-800 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex items-center gap-3">
                {/* Icon Selector */}
                <div className="flex-shrink-0">
                     <IconSelector 
                        value={initialProvider?.icon || 'cube'} 
                        onChange={(i) => { if (initialProvider) updateProvider(initialProvider.id, { icon: i }); }} 
                        onHover={setPreviewIcon}
                        compact 
                        trigger={
                            <button className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center hover:opacity-80 transition-all border border-gray-100 dark:border-gray-700">
                                <AppIcon icon={previewIcon || initialProvider?.icon || 'cube'} size={24} />
                            </button>
                        }
                     />
                </div>

                <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Active Channel</label>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="group flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none">
                                <span>{initialProvider ? name : 'Select Channel'}</span>
                                <MdUnfoldMore className="text-gray-400 group-hover:text-blue-500" size={20} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[240px] bg-white dark:bg-[#1E1E1E]">
                            {allProviders.map(p => (
                                <DropdownMenuItem 
                                    key={p.id} 
                                    onClick={() => onSelectProvider(p.id)}
                                    className={cn("gap-2", p.id === initialProvider?.id && "bg-gray-100 dark:bg-zinc-800")}
                                >
                                    <AppIcon icon={p.icon || 'cube'} size={16} />
                                    <span className="truncate">{p.name}</span>
                                    {p.id === initialProvider?.id && <MdCheck className="ml-auto text-blue-500" />}
                                </DropdownMenuItem>
                            ))}
                            {allProviders.length > 0 && <DropdownMenuSeparator />}
                            <DropdownMenuItem onClick={onAddProvider} className="text-blue-600 dark:text-blue-400 gap-2">
                                <MdAdd size={16} />
                                Create New Channel
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            
            {initialProvider && (
                <div className="flex items-center gap-2">
                    <button onClick={handleDeleteProvider} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete Channel">
                        <MdDelete size={18} />
                    </button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-90 transition-all shadow-sm">
                        <MdSave size={18} /> Save
                    </button>
                </div>
            )}
          </div>

          {initialProvider ? (
              <div className="flex flex-wrap gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex-1 min-w-[240px] space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Base URL</label>
                      <input type="text" value={apiHost} onChange={(e) => setApiHost(e.target.value)} placeholder="https://api.example.com" className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-blue-500/20 text-sm outline-none" />
                  </div>
                  <div className="flex-1 min-w-[240px] space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">API Key</label>
                      <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-blue-500/20 text-sm font-mono outline-none" />
                  </div>
              </div>
          ) : (
              <div className="py-8 text-center text-gray-400 text-sm">
                  Please create or select a channel to configure.
              </div>
          )}
        </div>

        {/* Models Section */}
        {initialProvider && (
            <div className="flex-1 overflow-y-auto pt-6 scrollbar-none animate-in fade-in">
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest">Models</h3>
                            <span className="text-xs text-gray-400 font-normal">({providerModels.length})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleCheckConnection} disabled={isChecking || !apiKey} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors border border-gray-200 dark:border-gray-700">
                                {isChecking ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <MdCheck size={14} />}
                                {checkResult === 'success' ? 'Connected' : 'Check'}
                            </button>
                            <button onClick={handleFetchModels} disabled={isFetchingModels || !apiKey} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-blue-100 dark:border-blue-900/30">
                                {isFetchingModels ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <MdCloudDownload size={14} />}
                                Fetch Models
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {fetchedModels.length > 0 && (
                            <div className="bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 animate-in fade-in zoom-in-95">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Discovered Remote Models</span>
                                    <button onClick={() => setFetchedModels([])} className="text-xs text-blue-600 hover:underline">Done</button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                                    {fetchedModels.map(id => (
                                        <ModelListItem key={id} modelId={id} isAdded={providerModels.some(m => m.id === id)} onAdd={() => handleAddModel(id)} />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            {providerModels.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 bg-gray-50/50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                    <p className="text-sm">No models configured.</p>
                                </div>
                            ) : (
                                Object.entries(groupModelsList(providerModels.map(m => m.id))).sort().map(([group, groupModels]) => {
                                    const isCollapsed = collapsedGroups.has(`added-${group}`);
                                    return (
                                        <div key={group} className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900/50">
                                            <button onClick={() => toggleGroup(`added-${group}`)} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50/50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    {isCollapsed ? <MdKeyboardArrowRight size={18} /> : <MdKeyboardArrowDown size={18} />}
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{group}</span>
                                                </div>
                                            </button>
                                            {!isCollapsed && (
                                                <div className="p-2 grid grid-cols-1 gap-1">
                                                    {groupModels.map(id => (
                                                        <ModelListItem key={id} modelId={id} isAdded={true} onRemove={() => deleteModel(id)} />
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
            </div>
        )}

        {/* Footer */}
        {initialProvider && (
            <div className="pt-4 mt-auto">
            <button onClick={() => setIsAddingModel(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-sm font-medium">
                    <MdAdd size={18} /> Add Model Manually
            </button>
            </div>
        )}
      </div>

      <AddModelModal isOpen={isAddingModel} onClose={() => setIsAddingModel(false)} onAdd={handleAddModel} />
    </>
  );
}

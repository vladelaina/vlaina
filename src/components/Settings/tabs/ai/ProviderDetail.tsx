import { useState, useEffect } from 'react';
import { MdCheck, MdSave, MdAdd, MdDelete, MdCloudDownload, MdKeyboardArrowDown, MdKeyboardArrowRight, MdUnfoldMore, MdSelectAll, MdClear } from 'react-icons/md';
import { useAIStore } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import { cn } from '@/lib/utils';
import { Provider } from '@/lib/ai/types';
import { AppIcon } from '@/components/common/AppIcon';
import { ModelListItem } from './components/ModelListItem';
import { AddModelModal } from './components/AddModelModal';
import { generateModelGroup } from '@/lib/ai/utils';
import { IconSelector } from '@/components/common/IconSelector';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
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
    addModels, 
    deleteModel
  } = useAIStore();

  const [name, setName] = useState(initialProvider?.name || '');
  const [apiKey, setApiKey] = useState(initialProvider?.apiKey || '');
  const [apiHost, setApiHost] = useState(initialProvider?.apiHost || '');
  
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<'success' | 'error' | null>(null);
  
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [previewIcon, setPreviewIcon] = useState<string | null>(null);

  const providerModels = initialProvider 
    ? models.filter(m => m.providerId === initialProvider.id)
    : [];

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
    setIsDeleting(false);
    setPreviewIcon(null);
  }, [initialProvider]);

  const handleSave = () => {
    if (initialProvider) {
      updateProvider(initialProvider.id, { name, apiKey, apiHost, updatedAt: Date.now() });
      setCheckResult('success');
      setTimeout(() => setCheckResult(null), 2000);
    } 
  };

  const handleCheckConnection = async () => {
    if (!apiKey.trim()) return;
    setIsChecking(true);
    setCheckResult(null);

    try {
      const tempProvider: Provider = { id: initialProvider?.id || 'temp', name, type: 'newapi', apiHost, apiKey, enabled: true, createdAt: 0, updatedAt: 0 };
      const success = await openaiClient.testConnection(tempProvider);
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
      const modelsList = await openaiClient.getModels(tempProvider);
      if (modelsList.length === 0) setFetchError('No models found.');
      else setFetchedModels(modelsList);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch models');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleAddModel = (id: string) => {
    if (!id.trim() || !initialProvider) return;
    const exists = providerModels.some(m => m.id === id);
    if (exists) return;

    addModel({
      id: id.trim(),
      name: id.trim(),
      providerId: initialProvider.id,
      enabled: true
    });
  };

  const handleBatchAdd = (ids: string[]) => {
      if (!initialProvider || ids.length === 0) return;
      const newIds = ids.filter(id => !providerModels.some(m => m.id === id));
      if (newIds.length === 0) return;

      addModels(newIds.map(id => ({
          id,
          name: id,
          providerId: initialProvider!.id,
          enabled: true
      })));
  };

  const toggleGroup = (groupKey: string) => {
      const newSet = new Set(collapsedGroups);
      if (newSet.has(groupKey)) newSet.delete(groupKey);
      else newSet.add(groupKey);
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

  const fetchedGroups = groupModelsList(fetchedModels);
  const addedGroups = groupModelsList(providerModels.map(m => m.id));

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="pb-6 border-b border-gray-100 dark:border-gray-800 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex items-center gap-3">
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
                            <button className="group flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none">
                                <span>{initialProvider ? name : 'Select Channel'}</span>
                                <MdUnfoldMore className="text-gray-400 group-hover:text-gray-600" size={20} />
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
                                    {p.id === initialProvider?.id && <MdCheck className="ml-auto text-black dark:text-white" />}
                                </DropdownMenuItem>
                            ))}
                            {allProviders.length > 0 && <DropdownMenuSeparator />}
                            <DropdownMenuItem onClick={onAddProvider} className="text-gray-900 dark:text-gray-100 gap-2 font-medium">
                                <MdAdd size={16} />
                                Create New Channel
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            
            {initialProvider && (
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsDeleting(true)} 
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" 
                        title="Delete Channel"
                    >
                        <MdDelete size={18} />
                    </button>
                </div>
            )}
          </div>

          {initialProvider ? (
              <div className="flex flex-wrap gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex-1 min-w-[240px] space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Base URL</label>
                      <input type="text" value={apiHost} onChange={(e) => setApiHost(e.target.value)} onBlur={handleSave} placeholder="https://api.example.com" className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-gray-500/20 text-sm outline-none" />
                  </div>
                  <div className="flex-1 min-w-[240px] space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">API Key</label>
                      <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} onBlur={handleSave} placeholder="sk-..." className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-gray-500/20 text-sm font-mono outline-none" />
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
                <div className="space-y-6">
                    {/* Header Controls */}
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
                            <button onClick={handleFetchModels} disabled={isFetchingModels || !apiKey} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white dark:text-black bg-black dark:bg-white hover:opacity-80 rounded-lg transition-colors border border-transparent">
                                {isFetchingModels ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <MdCloudDownload size={14} />}
                                Fetch Models
                            </button>
                        </div>
                    </div>

                    {/* Discovered Models (Grouped & Batch Actions) - Monochrome Style */}
                    {fetchedModels.length > 0 && (
                        <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden animate-in fade-in zoom-in-95">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-900/50">
                                <div className="flex items-center gap-2">
                                    <MdCloudDownload className="text-gray-500 w-4 h-4" />
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Discovered Remote Models</span>
                                    <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] px-1.5 py-0.5 rounded-md font-mono">{fetchedModels.length}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleBatchAdd(fetchedModels)} className="flex items-center gap-1 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors">
                                        <MdSelectAll size={14} /> Add All
                                    </button>
                                    <div className="w-[1px] h-3 bg-gray-300 dark:bg-gray-700" />
                                    <button onClick={() => setFetchedModels([])} className="text-xs font-bold text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition-colors">
                                        Close
                                    </button>
                                </div>
                            </div>
                            
                            <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
                                {Object.entries(fetchedGroups).sort().map(([group, groupModels]) => {
                                    const isCollapsed = collapsedGroups.has(`fetched-${group}`);
                                    const allAdded = groupModels.every(id => providerModels.some(m => m.id === id));
                                    
                                    return (
                                        <div key={group} className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-black/20">
                                            <div className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                <button onClick={() => toggleGroup(`fetched-${group}`)} className="flex items-center gap-2 flex-1 text-left">
                                                    {isCollapsed ? <MdKeyboardArrowRight size={16} className="text-gray-400" /> : <MdKeyboardArrowDown size={16} className="text-gray-400" />}
                                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">{group}</span>
                                                    <span className="text-[10px] text-gray-400">({groupModels.length})</span>
                                                </button>
                                                
                                                {!allAdded && (
                                                    <button 
                                                        onClick={() => handleBatchAdd(groupModels)}
                                                        className="text-[10px] font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-white/10 px-2 py-1 rounded transition-colors"
                                                    >
                                                        Add Group
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {!isCollapsed && (
                                                <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                    {groupModels.map(id => (
                                                        <ModelListItem 
                                                            key={id} 
                                                            modelId={id} 
                                                            isAdded={providerModels.some(m => m.id === id)} 
                                                            onAdd={() => handleAddModel(id)} 
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

                    {/* Added Models List */}
                    <div className="space-y-2">
                        {providerModels.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 bg-gray-50/50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                <p className="text-sm">No models configured.</p>
                            </div>
                        ) : (
                            Object.entries(addedGroups).sort().map(([group, groupModels]) => {
                                const isCollapsed = collapsedGroups.has(`added-${group}`);
                                return (
                                    <div key={group} className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900/50">
                                        <button onClick={() => toggleGroup(`added-${group}`)} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50/50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                            <div className="flex items-center gap-2">
                                                {isCollapsed ? <MdKeyboardArrowRight size={18} className="text-gray-400" /> : <MdKeyboardArrowDown size={18} className="text-gray-400" />}
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{group}</span>
                                                <span className="text-[10px] text-gray-400">({groupModels.length})</span>
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
      
      <ConfirmDialog
        isOpen={isDeleting}
        onClose={() => setIsDeleting(false)}
        onConfirm={() => {
            if (initialProvider) deleteProvider(initialProvider.id);
        }}
        title="Delete Channel"
        description="Are you sure you want to delete this channel? All configuration and models will be lost."
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}
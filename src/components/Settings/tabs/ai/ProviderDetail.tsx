import { useState, useEffect } from 'react';
import { MdCheck, MdSave, MdAdd, MdDelete, MdRefresh, MdContentCopy } from 'react-icons/md';
import { useAIStore } from '@/stores/useAIStore';
import { ProviderConfig } from './constants';
import { newAPIClient } from '@/lib/ai/providers/newapi';
import { cn } from '@/lib/utils';
import { Provider, AIModel } from '@/lib/ai/types';

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

  const [apiKey, setApiKey] = useState(initialProvider?.apiKey || '');
  const [apiHost, setApiHost] = useState(initialProvider?.apiHost || config.defaultBaseUrl);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<'success' | 'error' | null>(null);
  
  // Model list management
  const [newModelId, setNewModelId] = useState('');
  const [isAddingModel, setIsAddingModel] = useState(false);

  const providerModels = initialProvider 
    ? models.filter(m => m.providerId === initialProvider.id)
    : [];

  // Update local state when provider changes
  useEffect(() => {
    setApiKey(initialProvider?.apiKey || '');
    setApiHost(initialProvider?.apiHost || config.defaultBaseUrl);
    setCheckResult(null);
  }, [initialProvider, config]);

  const handleSave = () => {
    if (!apiKey.trim()) return;

    if (initialProvider) {
      updateProvider(initialProvider.id, {
        apiKey,
        apiHost,
        updatedAt: Date.now()
      });
      setCheckResult('success');
      setTimeout(() => setCheckResult(null), 2000);
    } else {
      // Create new
      addProvider({
        name: config.name,
        type: 'newapi', // All are compatible
        apiHost,
        apiKey,
        enabled: true
      });
    }
  };

  const handleCheckConnection = async () => {
    if (!apiKey.trim()) return;
    setIsChecking(true);
    setCheckResult(null);

    try {
      // Create a temporary provider object for testing
      const tempProvider: Provider = {
        id: 'temp',
        name: config.name,
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

  const handleAddModel = () => {
    if (!newModelId.trim() || !initialProvider) return;
    
    addModel({
      id: newModelId.trim(),
      name: newModelId.trim(),
      providerId: initialProvider.id,
      enabled: true
    });
    setNewModelId('');
    setIsAddingModel(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 pb-6 border-b border-gray-100 dark:border-gray-800">
        <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-xl p-2 flex items-center justify-center">
          <img src={config.icon} alt={config.name} className="w-full h-full object-contain" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{config.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {config.description || `Configure ${config.name} settings`}
          </p>
        </div>
        <div className="ml-auto">
           {/* Enabled Toggle could go here */}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 space-y-8">
        {/* Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
            Configuration
          </h3>
          
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Base URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={apiHost}
                  onChange={(e) => setApiHost(e.target.value)}
                  placeholder="https://api.example.com/v1"
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

          <div className="flex items-center gap-3 pt-2">
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
              {isChecking ? 'Checking...' : checkResult === 'success' ? 'Connected' : checkResult === 'error' ? 'Connection Failed' : 'Check Connection'}
            </button>
          </div>
        </div>

        {/* Models */}
        {initialProvider && (
          <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-800">
             <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                  Models
                </h3>
                <button
                    onClick={() => setIsAddingModel(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                    <MdAdd className="w-3.5 h-3.5" />
                    Add Model
                </button>
             </div>

             {isAddingModel && (
                 <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-top-2">
                     <label className="block text-xs font-medium text-gray-500 mb-1.5">Model ID (e.g., gpt-4-turbo)</label>
                     <div className="flex gap-2">
                         <input 
                            type="text" 
                            value={newModelId}
                            onChange={(e) => setNewModelId(e.target.value)}
                            placeholder="Enter model ID..."
                            className="flex-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddModel();
                                if (e.key === 'Escape') setIsAddingModel(false);
                            }}
                         />
                         <button 
                            onClick={handleAddModel}
                            disabled={!newModelId.trim()}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                         >
                             Add
                         </button>
                         <button 
                            onClick={() => setIsAddingModel(false)}
                            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
                         >
                             Cancel
                         </button>
                     </div>
                     <p className="text-[10px] text-gray-400 mt-2">
                        Tip: You can add multiple models by separating IDs with commas.
                     </p>
                 </div>
             )}

             <div className="space-y-2">
                {providerModels.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
                        <p className="text-sm">No models configured</p>
                    </div>
                ) : (
                    providerModels.map(model => (
                        <div key={model.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 group hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                            <div className="min-w-0">
                                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{model.name}</div>
                                <div className="text-xs text-gray-500 font-mono truncate">{model.id}</div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => deleteModel(model.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                    title="Remove model"
                                >
                                    <MdDelete className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';

interface AddModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (id: string, name: string) => void;
}

export function AddModelModal({ isOpen, onClose, onAdd }: AddModelModalProps) {
  const [modelId, setModelId] = useState('');
  const [modelName, setModelName] = useState('');

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setModelId('');
      setModelName('');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!modelId.trim()) return;
    onAdd(modelId, modelName);
    // Don't close here, let parent decide or reset? 
    // Parent logic was: call handleAddModel, then close.
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Model</h3>
                <button 
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    ✕
                </button>
            </div>
            
            <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Model ID <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={modelId}
                        onChange={(e) => {
                            setModelId(e.target.value);
                            // Auto-fill name if empty or matches
                            if (!modelName || modelName === modelId) {
                                setModelName(e.target.value);
                            }
                        }}
                        placeholder="e.g. gpt-4-turbo"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                    />
                    <p className="text-xs text-gray-500">The exact ID used in API requests.</p>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Display Name</label>
                    <input
                        type="text"
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        placeholder="e.g. GPT-4 Turbo"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!modelId.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Add Model
                </button>
            </div>
        </div>
    </div>
  );
}

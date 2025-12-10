import { useState, useEffect } from 'react';
import { Folder, FolderOpen, HardDrive, ExternalLink } from 'lucide-react';
import { getBasePath } from '@/lib/storage/paths';
import { openPath } from '@tauri-apps/plugin-opener';

/**
 * Storage tab content - data location settings
 * 
 * Currently shows the storage path. 
 * Future: Allow users to customize storage location.
 */
export function StorageTab() {
  const [storagePath, setStoragePath] = useState<string>('加载中...');

  useEffect(() => {
    getBasePath().then(path => {
      setStoragePath(path);
    }).catch(() => {
      setStoragePath('无法获取路径');
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <div>
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          数据存储
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          管理你的数据存储位置
        </p>
      </div>

      {/* Current Storage Location */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          当前存储位置
        </label>
        
        <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <HardDrive className="size-5 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
          <code className="text-xs text-zinc-600 dark:text-zinc-300 break-all font-mono flex-1">
            {storagePath}
          </code>
          <button
            onClick={async () => {
              try {
                await openPath(storagePath);
              } catch (e) {
                console.error('Failed to open path:', e);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-600 transition-colors text-xs flex-shrink-0"
            title="在文件管理器中打开"
          >
            <ExternalLink className="size-3.5" />
            <span>打开</span>
          </button>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          所有数据（进度、任务、归档等）都存储在此位置
        </p>
      </div>

      {/* Custom Location (Future Feature) */}
      <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          自定义存储位置
        </label>
        
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed text-sm"
        >
          <FolderOpen className="size-4" />
          <span>选择文件夹</span>
          <span className="ml-auto text-xs bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded">
            即将推出
          </span>
        </button>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          将来你可以把数据迁移到任意位置，比如 Documents 文件夹或云同步目录
        </p>
      </div>

      {/* Data Structure Info */}
      <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          数据结构
        </label>
        
        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 font-mono text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <Folder className="size-3.5" />
            <span>Nekotick/</span>
          </div>
          <div className="ml-5 space-y-0.5 mt-1">
            <div className="text-zinc-400 dark:text-zinc-500">├── .nekotick/ <span className="text-zinc-400">(应用元数据)</span></div>
            <div>├── progress/ <span className="text-zinc-400">(进度记录)</span></div>
            <div>├── tasks/ <span className="text-zinc-400">(任务列表)</span></div>
            <div>├── archive/ <span className="text-zinc-400">(归档记录)</span></div>
            <div>└── time-tracker/ <span className="text-zinc-400">(时间追踪)</span></div>
          </div>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          你可以用任何文本编辑器查看和编辑这些文件
        </p>
      </div>
    </div>
  );
}

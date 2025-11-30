import { useState } from 'react';
import { ArrowLeft, Plus, Minus, Trash2, TrendingUp, Hash } from 'lucide-react';
import { useProgressStore, type ProgressItem, type CounterItem } from '@/stores/useProgressStore';

interface ProgressPageProps {
  onBack: () => void;
}

type CreateMode = null | 'progress' | 'counter';

export function ProgressPage({ onBack }: ProgressPageProps) {
  const { items, addProgress, addCounter, updateCurrent, deleteItem } = useProgressStore();
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  
  // Progress form state
  const [progressForm, setProgressForm] = useState({
    title: '',
    note: '',
    direction: 'increment' as 'increment' | 'decrement',
    total: 100,
    step: 1,
    unit: '',
  });
  
  // Counter form state
  const [counterTitle, setCounterTitle] = useState('');
  const [counterStep, setCounterStep] = useState(1);

  const handleCreateProgress = () => {
    if (!progressForm.title.trim()) return;
    addProgress({
      title: progressForm.title.trim(),
      note: progressForm.note.trim() || undefined,
      direction: progressForm.direction,
      total: progressForm.total,
      step: progressForm.step,
      unit: progressForm.unit.trim(),
    });
    setProgressForm({ title: '', note: '', direction: 'increment', total: 100, step: 1, unit: '' });
    setCreateMode(null);
  };

  const handleCreateCounter = () => {
    if (!counterTitle.trim()) return;
    addCounter(counterTitle.trim(), counterStep);
    setCounterTitle('');
    setCounterStep(1);
    setCreateMode(null);
  };

  const progressItems = items.filter((item): item is ProgressItem => item.type === 'progress');
  const counterItems = items.filter((item): item is CounterItem => item.type === 'counter');

  return (
    <div className="h-full bg-white dark:bg-zinc-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">进度</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Progress Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">进度</h2>
            <button
              onClick={() => setCreateMode(createMode === 'progress' ? null : 'progress')}
              className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Plus className="size-4" />
            </button>
          </div>
          
          {/* Create Progress Form */}
          {createMode === 'progress' && (
            <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg space-y-3">
              <input
                type="text"
                placeholder="标题"
                value={progressForm.title}
                onChange={(e) => setProgressForm({ ...progressForm, title: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400"
                autoFocus
              />
              <input
                type="text"
                placeholder="备注（可选）"
                value={progressForm.note}
                onChange={(e) => setProgressForm({ ...progressForm, note: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400"
              />
              <div className="flex gap-2">
                <select
                  value={progressForm.direction}
                  onChange={(e) => setProgressForm({ ...progressForm, direction: e.target.value as 'increment' | 'decrement' })}
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none"
                >
                  <option value="increment">递增</option>
                  <option value="decrement">递减</option>
                </select>
                <input
                  type="number"
                  placeholder="总量"
                  value={progressForm.total}
                  onChange={(e) => setProgressForm({ ...progressForm, total: Number(e.target.value) || 0 })}
                  className="w-24 px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="步长"
                  value={progressForm.step}
                  onChange={(e) => setProgressForm({ ...progressForm, step: Number(e.target.value) || 1 })}
                  className="w-24 px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400"
                />
                <input
                  type="text"
                  placeholder="单位（可选）"
                  value={progressForm.unit}
                  onChange={(e) => setProgressForm({ ...progressForm, unit: e.target.value })}
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCreateMode(null)}
                  className="flex-1 px-3 py-2 text-sm text-zinc-600 bg-zinc-200 dark:bg-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateProgress}
                  className="flex-1 px-3 py-2 text-sm text-white bg-zinc-800 dark:bg-zinc-600 rounded-md hover:bg-zinc-700 dark:hover:bg-zinc-500 transition-colors"
                >
                  创建
                </button>
              </div>
            </div>
          )}
          
          {/* Progress List */}
          <div className="space-y-2">
            {progressItems.length === 0 && createMode !== 'progress' && (
              <p className="text-sm text-zinc-400 text-center py-4">暂无进度</p>
            )}
            {progressItems.map((item) => (
              <ProgressCard key={item.id} item={item} onUpdate={updateCurrent} onDelete={deleteItem} />
            ))}
          </div>
        </section>

        {/* Counter Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">计数</h2>
            <button
              onClick={() => setCreateMode(createMode === 'counter' ? null : 'counter')}
              className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Plus className="size-4" />
            </button>
          </div>
          
          {/* Create Counter Form */}
          {createMode === 'counter' && (
            <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg space-y-3">
              <input
                type="text"
                placeholder="标题"
                value={counterTitle}
                onChange={(e) => setCounterTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400"
                autoFocus
              />
              <input
                type="number"
                placeholder="每次增减量"
                value={counterStep}
                onChange={(e) => setCounterStep(Number(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setCreateMode(null)}
                  className="flex-1 px-3 py-2 text-sm text-zinc-600 bg-zinc-200 dark:bg-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateCounter}
                  className="flex-1 px-3 py-2 text-sm text-white bg-zinc-800 dark:bg-zinc-600 rounded-md hover:bg-zinc-700 dark:hover:bg-zinc-500 transition-colors"
                >
                  创建
                </button>
              </div>
            </div>
          )}
          
          {/* Counter List */}
          <div className="space-y-2">
            {counterItems.length === 0 && createMode !== 'counter' && (
              <p className="text-sm text-zinc-400 text-center py-4">暂无计数</p>
            )}
            {counterItems.map((item) => (
              <CounterCard key={item.id} item={item} onUpdate={updateCurrent} onDelete={deleteItem} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ProgressCard({ 
  item, 
  onUpdate, 
  onDelete 
}: { 
  item: ProgressItem; 
  onUpdate: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
}) {
  const percentage = Math.round((item.current / item.total) * 100);
  const step = item.direction === 'increment' ? item.step : -item.step;

  return (
    <div className="group p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{item.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdate(item.id, -step)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            onClick={() => onUpdate(item.id, step)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {item.note && (
        <p className="text-xs text-zinc-400 mb-2">{item.note}</p>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-zinc-500 whitespace-nowrap">
          {item.current}/{item.total}{item.unit && ` ${item.unit}`}
        </span>
      </div>
    </div>
  );
}

function CounterCard({ 
  item, 
  onUpdate, 
  onDelete 
}: { 
  item: CounterItem; 
  onUpdate: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
      <div className="flex items-center gap-2">
        <Hash className="size-4 text-zinc-400" />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{item.title}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdate(item.id, -item.step)}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <Minus className="size-4" />
        </button>
        <span className="w-12 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {item.current}
        </span>
        <button
          onClick={() => onUpdate(item.id, item.step)}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <Plus className="size-4" />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

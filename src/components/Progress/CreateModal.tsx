import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type CreateType = 'progress' | 'counter';

interface ProgressFormData {
  title: string;
  note: string;
  direction: 'increment' | 'decrement';
  total: number;
  step: number;
  unit: string;
}

interface CounterFormData {
  title: string;
  step: number;
  unit: string;
  frequency: 'daily' | 'weekly' | 'monthly';
}

interface CreateModalProps {
  open: boolean;
  initialType?: CreateType;
  onClose: () => void;
  onCreateProgress: (data: ProgressFormData) => void;
  onCreateCounter: (data: CounterFormData) => void;
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
] as const;

/**
 * 创建进度/计数器的模态框
 */
export function CreateModal({
  open,
  initialType = 'progress',
  onClose,
  onCreateProgress,
  onCreateCounter,
}: CreateModalProps) {
  const [type, setType] = useState<CreateType>(initialType);
  
  // Progress 表单状态
  const [progressForm, setProgressForm] = useState<ProgressFormData>({
    title: '',
    note: '',
    direction: 'increment',
    total: 100,
    step: 1,
    unit: '次',
  });
  
  // Counter 表单状态
  const [counterForm, setCounterForm] = useState<CounterFormData>({
    title: '',
    step: 1,
    unit: '次',
    frequency: 'daily',
  });

  // 重置表单
  useEffect(() => {
    if (open) {
      setType(initialType);
      setProgressForm({
        title: '',
        note: '',
        direction: 'increment',
        total: 100,
        step: 1,
        unit: '次',
      });
      setCounterForm({
        title: '',
        step: 1,
        unit: '次',
        frequency: 'daily',
      });
    }
  }, [open, initialType]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleSubmit = () => {
    if (type === 'progress') {
      if (!progressForm.title.trim()) return;
      onCreateProgress({
        ...progressForm,
        title: progressForm.title.trim(),
        note: progressForm.note.trim(),
        unit: progressForm.unit.trim() || '次',
      });
    } else {
      if (!counterForm.title.trim()) return;
      onCreateCounter({
        ...counterForm,
        title: counterForm.title.trim(),
        unit: counterForm.unit.trim() || '次',
      });
    }
    onClose();
  };

  const isValid = type === 'progress' 
    ? progressForm.title.trim().length > 0 
    : counterForm.title.trim().length > 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-[400px] max-w-full pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setType('progress')}
                    className={`text-sm transition-colors ${
                      type === 'progress'
                        ? 'text-zinc-900 dark:text-zinc-100 font-medium'
                        : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                    }`}
                  >
                    进度
                  </button>
                  <span className="text-zinc-300 dark:text-zinc-600">|</span>
                  <button
                    onClick={() => setType('counter')}
                    className={`text-sm transition-colors ${
                      type === 'counter'
                        ? 'text-zinc-900 dark:text-zinc-100 font-medium'
                        : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                    }`}
                  >
                    计数器
                  </button>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-5 space-y-4">
                {type === 'progress' ? (
                  <ProgressFormContent form={progressForm} setForm={setProgressForm} />
                ) : (
                  <CounterFormContent form={counterForm} setForm={setCounterForm} />
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-200 dark:border-zinc-700">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!isValid}
                  className="px-4 py-2 text-sm bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-800 rounded-md hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  创建
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// Progress 表单内容
function ProgressFormContent({
  form,
  setForm,
}: {
  form: ProgressFormData;
  setForm: React.Dispatch<React.SetStateAction<ProgressFormData>>;
}) {
  return (
    <>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">标题</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="输入标题..."
          className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400 dark:focus:border-zinc-500 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">备注</label>
        <input
          type="text"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="可选..."
          className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400 dark:focus:border-zinc-500 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
        />
      </div>

      <div>
        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">类型</label>
        <div className="flex gap-2">
          <button
            onClick={() => setForm({ ...form, direction: 'increment' })}
            className={`flex-1 py-2 text-xs rounded-md border transition-colors ${
              form.direction === 'increment'
                ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-800 border-transparent'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600'
            }`}
          >
            递增
          </button>
          <button
            onClick={() => setForm({ ...form, direction: 'decrement' })}
            className={`flex-1 py-2 text-xs rounded-md border transition-colors ${
              form.direction === 'decrement'
                ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-800 border-transparent'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600'
            }`}
          >
            递减
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">目标</label>
          <input
            type="number"
            value={form.total}
            onChange={(e) => setForm({ ...form, total: Number(e.target.value) || 0 })}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
          />
        </div>
        <div className="w-20">
          <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">步长</label>
          <input
            type="number"
            value={form.step}
            onChange={(e) => setForm({ ...form, step: Number(e.target.value) || 1 })}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
          />
        </div>
        <div className="w-20">
          <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">单位</label>
          <input
            type="text"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
          />
        </div>
      </div>
    </>
  );
}

// Counter 表单内容
function CounterFormContent({
  form,
  setForm,
}: {
  form: CounterFormData;
  setForm: React.Dispatch<React.SetStateAction<CounterFormData>>;
}) {
  return (
    <>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">标题</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="输入标题..."
          className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400 dark:focus:border-zinc-500 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">频率</label>
        <div className="flex gap-2">
          {FREQUENCY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setForm({ ...form, frequency: opt.value })}
              className={`flex-1 py-2 text-xs rounded-md border transition-colors ${
                form.frequency === opt.value
                  ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-800 border-transparent'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="w-24">
          <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">步长</label>
          <input
            type="number"
            value={form.step}
            onChange={(e) => setForm({ ...form, step: Number(e.target.value) || 1 })}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">单位</label>
          <input
            type="text"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
          />
        </div>
      </div>
    </>
  );
}

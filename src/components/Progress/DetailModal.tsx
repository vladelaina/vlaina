import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ProgressOrCounter } from '@/stores/useProgressStore';
import { IconPicker, getIconByName } from './IconPicker';

interface DetailModalProps {
  item: ProgressOrCounter | null;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<ProgressOrCounter>) => void;
  onDelete: (id: string) => void;
  onPreviewChange?: (icon?: string, title?: string) => void;
}

/**
 * 详情模态框 - 显示热力图和编辑功能
 */
export function DetailModal({ item, onClose, onUpdate, onDelete, onPreviewChange }: DetailModalProps) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<string | undefined>();

  // 同步 item 数据到表单
  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setIcon(item.icon);
    }
  }, [item]);

  // 实时预览：当图标或标题变化时通知父组件
  useEffect(() => {
    if (item && onPreviewChange) {
      onPreviewChange(icon, title);
    }
  }, [icon, title, item, onPreviewChange]);

  // 关闭时清除预览
  const handleClose = () => {
    onPreviewChange?.(undefined, undefined);
    onClose();
  };

  // ESC 关闭
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  const handleSave = () => {
    if (!item || !title.trim()) return;
    onPreviewChange?.(undefined, undefined);
    onUpdate(item.id, { title: title.trim(), icon });
    onClose();
  };

  const handleDelete = () => {
    if (!item) return;
    onDelete(item.id);
    handleClose();
  };

  // 计算统计数据
  const stats = item ? getStats(item) : null;

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-[420px] max-w-full pointer-events-auto max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">详情</span>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* 标题编辑 */}
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">标题</label>
                  <div className="flex gap-2">
                    <IconPicker value={icon} onChange={setIcon} />
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                    />
                  </div>
                </div>

                {/* 热力图 */}
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-2">活跃记录</label>
                  <HeatMap history={item.history || {}} />
                </div>

                {/* 统计信息 */}
                {stats && (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="py-2 bg-zinc-50 dark:bg-zinc-800 rounded-md">
                      <div className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{stats.totalOps}</div>
                      <div className="text-xs text-zinc-500">总操作次数</div>
                    </div>
                    <div className="py-2 bg-zinc-50 dark:bg-zinc-800 rounded-md">
                      <div className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{stats.activeDays}</div>
                      <div className="text-xs text-zinc-500">活跃天数</div>
                    </div>
                    <div className="py-2 bg-zinc-50 dark:bg-zinc-800 rounded-md">
                      <div className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{stats.streak}</div>
                      <div className="text-xs text-zinc-500">连续天数</div>
                    </div>
                  </div>
                )}

                {/* 创建时间 */}
                <div className="text-xs text-zinc-400">
                  创建于 {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                >
                  删除
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!title.trim()}
                    className="px-4 py-2 text-sm bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-800 rounded-md hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * 热力图组件
 */
function HeatMap({ history }: { history: Record<string, number> }) {
  // 生成最近 12 周的日期
  const weeks = 12;
  const today = new Date();
  const days: { date: string; count: number; dayOfWeek: number }[] = [];
  
  // 从今天往前推 weeks * 7 天
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split('T')[0];
    days.push({
      date: dateKey,
      count: history[dateKey] || 0,
      dayOfWeek: d.getDay(),
    });
  }

  // 按周分组
  const weekGroups: typeof days[] = [];
  let currentWeek: typeof days = [];
  
  for (const day of days) {
    currentWeek.push(day);
    if (day.dayOfWeek === 6) { // 周六结束一周
      weekGroups.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    weekGroups.push(currentWeek);
  }

  // 计算颜色等级
  const getColor = (count: number) => {
    if (count === 0) return 'bg-zinc-100 dark:bg-zinc-800';
    if (count <= 2) return 'bg-zinc-300 dark:bg-zinc-600';
    if (count <= 5) return 'bg-zinc-400 dark:bg-zinc-500';
    return 'bg-zinc-600 dark:bg-zinc-400';
  };

  return (
    <div className="flex gap-1 overflow-x-auto pb-2">
      {weekGroups.map((week, weekIndex) => (
        <div key={weekIndex} className="flex flex-col gap-1">
          {/* 补齐周开头的空白 */}
          {weekIndex === 0 && week[0]?.dayOfWeek > 0 && (
            Array.from({ length: week[0].dayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="w-3 h-3" />
            ))
          )}
          {week.map((day) => (
            <div
              key={day.date}
              className={`w-3 h-3 rounded-sm ${getColor(day.count)}`}
              title={`${day.date}: ${day.count} 次操作`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * 计算统计数据
 */
function getStats(item: ProgressOrCounter) {
  const history = item.history || {};
  const dates = Object.keys(history).sort();
  
  // 总操作次数
  const totalOps = Object.values(history).reduce((a, b) => a + b, 0);
  
  // 活跃天数
  const activeDays = dates.filter(d => history[d] > 0).length;
  
  // 连续天数（从今天往前数）
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split('T')[0];
    if (history[dateKey] && history[dateKey] > 0) {
      streak++;
    } else if (i > 0) { // 今天可以没有记录
      break;
    }
  }
  
  return { totalOps, activeDays, streak };
}

// 导出 getIconByName 供外部使用
export { getIconByName };

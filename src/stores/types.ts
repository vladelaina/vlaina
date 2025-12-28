/**
 * Store Types - 统一类型定义
 * 
 * 这个模块是所有任务/事件相关类型的统一导出入口。
 * 所有类型都从 UnifiedTask 派生，确保单一真相来源。
 * 
 * 设计原则：
 * 1. UnifiedTask 是唯一的核心类型定义（在 unifiedStorage.ts）
 * 2. 其他类型通过 type alias 或 Pick/Omit 派生
 * 3. 保持向后兼容，原有类型名称继续可用
 */

// ============ 核心类型导入 ============

// 从统一存储导入核心类型
import type { 
  UnifiedTask, 
  UnifiedGroup,
  UnifiedProgress,
  UnifiedArchiveSection,
  UnifiedArchiveEntry,
} from '@/lib/storage/unifiedStorage';

// 从统一颜色系统导入
import type { ItemColor } from '@/lib/colors';

// 从统一日期系统导入
import type { TimeView } from '@/lib/date';

// ============ 核心类型 Re-export ============

export type { 
  UnifiedTask, 
  UnifiedGroup,
  UnifiedProgress,
  UnifiedArchiveSection,
  UnifiedArchiveEntry,
};

export type { ItemColor };
export type { TimeView };

// ============ 派生类型定义 ============

/**
 * StoreTask - UnifiedTask 的别名
 * 
 * 保持向后兼容，用于 archive 组件等场景。
 * 推荐新代码直接使用 UnifiedTask。
 */
export type StoreTask = UnifiedTask;

/**
 * Task - UnifiedTask 的别名
 * 
 * 保持向后兼容，用于 useGroupStore 等场景。
 * 推荐新代码直接使用 UnifiedTask。
 */
export type Task = UnifiedTask;

/**
 * Group - UnifiedGroup 的别名
 * 
 * 保持向后兼容。
 */
export type Group = UnifiedGroup;

/**
 * CalendarEvent - 日历事件视图类型
 * 
 * 从 UnifiedTask 派生，包含日历视图所需的字段。
 * startDate 是必需的（日历事件必须有时间）。
 */
export interface CalendarEvent {
  id: string;
  content: string;
  startDate: number;  // 必需
  endDate: number;    // 必需
  isAllDay: boolean;
  color: ItemColor;
  completed: boolean;
  description?: string;
  location?: string;
  groupId: string;
}

/**
 * CalendarDisplayItem - 日历显示项类型
 * 
 * 扩展 CalendarEvent，包含计时器状态等显示所需的额外字段。
 */
export interface CalendarDisplayItem extends CalendarEvent {
  timerState?: 'idle' | 'running' | 'paused';
  timerStartedAt?: number;
  timerAccumulated?: number;
}

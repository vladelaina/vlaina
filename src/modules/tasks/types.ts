/**
 * Tasks Module Types
 * 任务模块类型定义
 */

// 任务分组
export interface Group {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
  updatedAt?: number;
  pinned?: boolean;
}

// 优先级: red (最高) > yellow > purple > green > default (最低)
export type Priority = 'red' | 'yellow' | 'purple' | 'green' | 'default';

// 优先级颜色映射
export const PRIORITY_COLORS: Record<Priority, string> = {
  red: '#ef4444',
  yellow: '#eab308',
  purple: '#a855f7',
  green: '#22c55e',
  default: '#d4d4d8',
} as const;

// 任务类型（用于持久化）
export interface StoreTask {
  id: string;
  content: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  scheduledTime?: string;
  order: number;
  groupId: string;
  priority?: Priority;
  
  // 时间估算和追踪
  estimatedMinutes?: number;
  actualMinutes?: number;
  
  // 层级结构（嵌套任务）
  parentId: string | null;
  collapsed: boolean;
  
  // 归档元数据 - 存储任务归档时的原始分组 ID
  originalGroupId?: string;
}

// 归档时间视图类型
export type ArchiveTimeView = 'day' | 'week' | 'month';

// 排序选项
export type SortOption = 'manual' | 'priority' | 'time' | 'created';

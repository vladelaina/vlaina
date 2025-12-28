/**
 * Calendar Transforms - 统一的任务到日历显示项转换
 * 
 * 这个模块是 UnifiedTask → CalendarDisplayItem 转换的唯一真相来源。
 * 所有需要将任务转换为日历显示格式的地方都应该使用这里的函数。
 * 
 * 设计原则：
 * 1. 单一真相来源 - 所有转换逻辑集中在这里
 * 2. 一致的默认值计算 - endDate 优先使用 estimatedMinutes
 * 3. 类型安全 - 使用 TypeScript 确保正确性
 */

import type { UnifiedTask } from '@/lib/storage/unifiedStorage';
import type { ItemColor } from '@/lib/colors';
import { DEFAULT_COLOR } from '@/lib/colors';
import { DEFAULT_EVENT_DURATION_MS } from './constants';

// ============ 类型定义 ============

/**
 * CalendarDisplayItem - 日历显示项类型
 * 
 * 这是日历视图中显示的完整项目类型。
 * 包含所有显示所需的字段，包括计时器状态。
 */
export interface CalendarDisplayItem {
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
  // 计时器状态
  timerState?: 'idle' | 'running' | 'paused';
  timerStartedAt?: number;
  timerAccumulated?: number;
}

/**
 * CalendarEvent - CalendarDisplayItem 的别名
 * 
 * 保持向后兼容，推荐新代码使用 CalendarDisplayItem。
 */
export type CalendarEvent = CalendarDisplayItem;

// ============ 转换函数 ============

/**
 * 计算事件的结束时间
 * 
 * 优先级：
 * 1. 使用任务的 endDate（如果存在）
 * 2. 使用任务的 estimatedMinutes 计算（如果存在）
 * 3. 使用默认时长 DEFAULT_EVENT_DURATION_MS
 * 
 * @param task - 源任务
 * @returns 结束时间戳
 */
export function calculateEndDate(task: UnifiedTask): number {
  if (task.endDate !== undefined) {
    return task.endDate;
  }
  
  if (task.startDate === undefined) {
    // 不应该发生，但为了类型安全
    return Date.now() + DEFAULT_EVENT_DURATION_MS;
  }
  
  if (task.estimatedMinutes !== undefined && task.estimatedMinutes > 0) {
    return task.startDate + task.estimatedMinutes * 60 * 1000;
  }
  
  return task.startDate + DEFAULT_EVENT_DURATION_MS;
}

/**
 * 将 UnifiedTask 转换为 CalendarDisplayItem
 * 
 * 这是所有日历显示转换的统一入口。
 * 确保所有地方使用相同的默认值计算逻辑。
 * 
 * @param task - 源任务（必须有 startDate）
 * @returns 日历显示项
 */
export function toCalendarDisplayItem(task: UnifiedTask): CalendarDisplayItem {
  if (task.startDate === undefined) {
    throw new Error(`Task ${task.id} has no startDate, cannot convert to CalendarDisplayItem`);
  }
  
  return {
    id: task.id,
    content: task.content,
    startDate: task.startDate,
    endDate: calculateEndDate(task),
    isAllDay: task.isAllDay || false,
    color: task.color || DEFAULT_COLOR,
    completed: task.completed,
    description: task.description,
    location: task.location,
    groupId: task.groupId,
    timerState: task.timerState,
    timerStartedAt: task.timerStartedAt,
    timerAccumulated: task.timerAccumulated,
  };
}

/**
 * 批量转换任务为日历显示项
 * 
 * 自动过滤掉没有 startDate 的任务。
 * 
 * @param tasks - 任务数组
 * @returns 日历显示项数组
 */
export function toCalendarDisplayItems(tasks: UnifiedTask[]): CalendarDisplayItem[] {
  return tasks
    .filter(t => t.startDate !== undefined)
    .map(toCalendarDisplayItem);
}


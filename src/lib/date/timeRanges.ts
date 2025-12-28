/**
 * 时间范围计算函数
 * 
 * 提供基于时间视图的范围键生成和显示格式化功能。
 */

import type { TimeView } from './index';
import {
  formatDateKey,
  getTodayKey,
  getYesterdayKey,
  getCurrentWeekKey,
  getCurrentMonthKey,
} from './dateKeys';

// 每周毫秒数
const MS_PER_WEEK = 604800000;

/**
 * 根据时间戳和视图类型获取时间范围键
 */
export function getTimeRangeKey(timestamp: number, timeView: TimeView): string {
  const date = new Date(timestamp);
  
  if (timeView === 'day') {
    return formatDateKey(date);
  } else if (timeView === 'week') {
    const firstDay = new Date(date);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    firstDay.setDate(date.getDate() + diff);
    const yearStart = new Date(firstDay.getFullYear(), 0, 1);
    const weekNum = Math.ceil((firstDay.getTime() - yearStart.getTime()) / MS_PER_WEEK) + 1;
    return `${firstDay.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  } else {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}

/**
 * 格式化时间范围键为显示文本
 * - 今天 -> "Today"
 * - 昨天 -> "Yesterday"
 * - 本周 -> "This Week"
 * - 本月 -> "This Month"
 * - 其他 -> 原始格式或详细格式
 */
export function formatTimeRangeDisplay(timeKey: string, timeView: TimeView): string {
  if (timeView === 'day') {
    const [year, month, day] = timeKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    if (date.getTime() === today.getTime()) {
      return 'Today';
    } else if (date.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      return `${year}-${month}-${day}`;
    }
  } else if (timeView === 'week') {
    const [yearStr, weekStr] = timeKey.split('-W');
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);
    
    // Calculate week start and end dates
    const yearStart = new Date(year, 0, 1);
    const firstMonday = new Date(yearStart);
    const dayOfWeek = yearStart.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    firstMonday.setDate(yearStart.getDate() + diff);
    
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    // Check if current week
    if (timeKey === getCurrentWeekKey()) {
      return 'This Week';
    }
    
    return `Week ${week} (${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()})`;
  } else {
    const [year, month] = timeKey.split('-');
    
    if (timeKey === getCurrentMonthKey()) {
      return 'This Month';
    }
    
    return `${year}-${month}`;
  }
}

/**
 * 获取默认展开的日期集合
 * - day: 今天和昨天
 * - week: 本周
 * - month: 本月
 */
export function getDefaultExpandedDates(timeView: TimeView): Set<string> {
  if (timeView === 'day') {
    return new Set([getTodayKey(), getYesterdayKey()]);
  } else if (timeView === 'week') {
    return new Set([getCurrentWeekKey()]);
  } else {
    return new Set([getCurrentMonthKey()]);
  }
}

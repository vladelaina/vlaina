/**
 * Calendar Module - 日历相关工具和常量
 * 
 * 这个模块是日历功能的统一导出入口。
 * 包含：
 * - 常量：默认事件时长等
 * - 转换函数：UnifiedTask → CalendarDisplayItem
 * - 类型：CalendarDisplayItem, CalendarEvent
 */

// 常量
export {
  DEFAULT_EVENT_DURATION_MINUTES,
  DEFAULT_EVENT_DURATION_MS,
} from './constants';

// 转换函数和类型
export {
  toCalendarDisplayItem,
  toCalendarDisplayItems,
  calculateEndDate,
  type CalendarDisplayItem,
  type CalendarEvent,
} from './transforms';

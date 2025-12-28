/**
 * 统一日期工具模块
 * 
 * 这个模块是日期键生成和时间范围计算的唯一真相来源。
 */

// 类型定义
export type TimeView = 'day' | 'week' | 'month';

// 日期键生成
export {
  formatDateKey,
  getTodayKey,
  getYesterdayKey,
  getCurrentWeekKey,
  getCurrentMonthKey,
} from './dateKeys';

// 时间范围计算
export {
  getTimeRangeKey,
  formatTimeRangeDisplay,
  getDefaultExpandedDates,
} from './timeRanges';

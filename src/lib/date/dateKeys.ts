/**
 * 日期键生成函数
 * 
 * 提供日期键的生成和格式化功能。
 */

// 每周毫秒数
const MS_PER_WEEK = 604800000;

/**
 * 格式化日期为日期键 (YYYY-MM-DD)
 */
export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * 获取今天的日期键 (YYYY-MM-DD)
 */
export function getTodayKey(): string {
  return formatDateKey(new Date());
}

/**
 * 获取昨天的日期键 (YYYY-MM-DD)
 */
export function getYesterdayKey(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDateKey(yesterday);
}

/**
 * 获取当前周的键 (YYYY-Wxx)
 * 使用 ISO 周，周一为一周的第一天
 */
export function getCurrentWeekKey(): string {
  const today = new Date();
  const firstDay = new Date(today);
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as first day
  firstDay.setDate(today.getDate() + diff);
  const yearStart = new Date(firstDay.getFullYear(), 0, 1);
  const weekNum = Math.ceil((firstDay.getTime() - yearStart.getTime()) / MS_PER_WEEK) + 1;
  return `${firstDay.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * 获取当前月的键 (YYYY-MM)
 */
export function getCurrentMonthKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

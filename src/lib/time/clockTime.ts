/**
 * 时钟时间解析和格式化模块
 * 
 * 处理时钟时间字符串（如 "14:30", "2:30pm"）的解析和格式化。
 * 时钟时间表示一天中的某个时刻，范围 0:00 - 23:59。
 */

// ============ 类型定义 ============

/**
 * 解析后的时钟时间
 */
export interface ClockTime {
  /** 小时 (0-23) */
  hours: number;
  /** 分钟 (0-59) */
  minutes: number;
}

// ============ 常量 ============

/** 一天的总分钟数 */
const MINUTES_PER_DAY = 1440;

/** PM 指示符 */
const PM_INDICATORS = ['pm', 'p.m.', 'p.m', '下午', '晚上'];

/** AM 指示符 */
const AM_INDICATORS = ['am', 'a.m.', 'a.m', '上午', '早上', '凌晨'];

// ============ 解析函数 ============

/**
 * 解析时钟时间字符串
 * 
 * 支持格式:
 * - 24小时制: "14:30", "14：30" (中文冒号), "1430", "14.30", "14-30"
 * - 12小时制: "2:30pm", "2:30 PM", "2pm", "230pm"
 * - 中文: "下午2:30", "上午9点", "下午2点30"
 * - 简单: "14" (表示 14:00), "9" (表示 9:00)
 * 
 * @param input - 时钟时间字符串
 * @returns 解析结果，无效输入返回 null
 * 
 * @example
 * parseClockTime("14:30")    // { hours: 14, minutes: 30 }
 * parseClockTime("2:30pm")   // { hours: 14, minutes: 30 }
 * parseClockTime("下午2:30") // { hours: 14, minutes: 30 }
 * parseClockTime("25:00")    // null (无效)
 */
export function parseClockTime(input: string): ClockTime | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // 标准化输入：去空格、小写、替换中文冒号和其他分隔符
  let str = input.trim().toLowerCase();
  str = str.replace(/[：.。\-－]/g, ':');
  str = str.replace(/\s+/g, ' ');

  // 检测 AM/PM 指示符
  let isPM = false;
  let isAM = false;

  for (const indicator of PM_INDICATORS) {
    if (str.includes(indicator)) {
      isPM = true;
      str = str.replace(indicator, '').trim();
      break;
    }
  }

  if (!isPM) {
    for (const indicator of AM_INDICATORS) {
      if (str.includes(indicator)) {
        isAM = true;
        str = str.replace(indicator, '').trim();
        break;
      }
    }
  }

  // 移除"点"字（中文时间格式）
  str = str.replace(/点/g, ':');
  // 清理多余的冒号
  str = str.replace(/:+$/, '');

  let hours = 0;
  let minutes = 0;

  // 尝试 HH:MM 格式
  const colonMatch = str.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    hours = parseInt(colonMatch[1], 10);
    minutes = parseInt(colonMatch[2], 10);
  } else {
    // 尝试 HHMM 格式 (3-4位数字)
    const numMatch = str.match(/^(\d{3,4})$/);
    if (numMatch) {
      const num = numMatch[1];
      if (num.length === 3) {
        hours = parseInt(num[0], 10);
        minutes = parseInt(num.slice(1), 10);
      } else {
        hours = parseInt(num.slice(0, 2), 10);
        minutes = parseInt(num.slice(2), 10);
      }
    } else {
      // 尝试纯小时格式 (1-2位数字)
      const hourOnlyMatch = str.match(/^(\d{1,2})$/);
      if (hourOnlyMatch) {
        hours = parseInt(hourOnlyMatch[1], 10);
        minutes = 0;
      } else {
        return null;
      }
    }
  }

  // 应用 AM/PM 转换
  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  // 验证范围
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

// ============ 格式化函数 ============

/**
 * 格式化分钟数为时钟时间字符串
 * 
 * @param totalMinutes - 从午夜开始的分钟数
 * @param use24Hour - 是否使用24小时制，默认 true
 * @returns 格式化的时钟时间字符串
 * 
 * @example
 * formatClockTime(870)         // "14:30"
 * formatClockTime(870, false)  // "2:30 PM"
 * formatClockTime(0, false)    // "12:00 AM"
 * formatClockTime(720)         // "12:00"
 */
export function formatClockTime(totalMinutes: number, use24Hour: boolean = true): string {
  // 归一化到有效范围 (0-1439)
  let normalized = totalMinutes % MINUTES_PER_DAY;
  if (normalized < 0) normalized += MINUTES_PER_DAY;

  const hours = Math.floor(normalized / 60) % 24;
  const minutes = Math.floor(normalized % 60);

  if (use24Hour) {
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  } else {
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = hours < 12 ? 'AM' : 'PM';
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }
}

// ============ 转换函数 ============

/**
 * 将 ClockTime 转换为分钟数
 * 
 * @param time - ClockTime 对象
 * @returns 从午夜开始的分钟数 (0-1439)
 * 
 * @example
 * clockTimeToMinutes({ hours: 14, minutes: 30 }) // 870
 */
export function clockTimeToMinutes(time: ClockTime): number {
  return time.hours * 60 + time.minutes;
}

/**
 * 将分钟数转换为 ClockTime
 * 
 * @param totalMinutes - 从午夜开始的分钟数
 * @returns ClockTime 对象
 * 
 * @example
 * minutesToClockTime(870) // { hours: 14, minutes: 30 }
 */
export function minutesToClockTime(totalMinutes: number): ClockTime {
  // 归一化到有效范围
  let normalized = totalMinutes % MINUTES_PER_DAY;
  if (normalized < 0) normalized += MINUTES_PER_DAY;

  return {
    hours: Math.floor(normalized / 60) % 24,
    minutes: Math.floor(normalized % 60),
  };
}



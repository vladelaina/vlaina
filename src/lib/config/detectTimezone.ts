// 检测用户系统时区
export function detectSystemTimezone(): number {
  try {
    // 获取系统时区偏移量（分钟）
    const offsetMinutes = -new Date().getTimezoneOffset();
    
    // 转换为小时（支持小数）
    const offsetHours = offsetMinutes / 60;
    
    // 四舍五入到最接近的 0.25 小时（15分钟）
    // 这样可以支持 .25, .5, .75 的偏移
    const roundedOffset = Math.round(offsetHours * 4) / 4;
    
    return roundedOffset;
  } catch (error) {
    console.error('Failed to detect system timezone:', error);
    // 如果检测失败，返回 GMT+8 作为默认值
    return 8;
  }
}

// 获取系统时区名称（用于调试）
export function getSystemTimezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return 'Unknown';
  }
}

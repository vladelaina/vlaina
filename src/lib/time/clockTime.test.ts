import { describe, it, expect } from 'vitest';
import {
  parseClockTime,
  formatClockTime,
  clockTimeToMinutes,
  minutesToClockTime,
} from './clockTime';

describe('parseClockTime', () => {
  describe('24小时制', () => {
    it('解析 HH:MM 格式', () => {
      expect(parseClockTime('14:30')).toEqual({ hours: 14, minutes: 30 });
      expect(parseClockTime('09:05')).toEqual({ hours: 9, minutes: 5 });
      expect(parseClockTime('0:00')).toEqual({ hours: 0, minutes: 0 });
      expect(parseClockTime('23:59')).toEqual({ hours: 23, minutes: 59 });
    });

    it('解析中文冒号', () => {
      expect(parseClockTime('14：30')).toEqual({ hours: 14, minutes: 30 });
    });

    it('解析 HHMM 格式', () => {
      expect(parseClockTime('1430')).toEqual({ hours: 14, minutes: 30 });
      expect(parseClockTime('0905')).toEqual({ hours: 9, minutes: 5 });
    });

    it('解析 HMM 格式', () => {
      expect(parseClockTime('930')).toEqual({ hours: 9, minutes: 30 });
    });

    it('解析纯小时', () => {
      expect(parseClockTime('14')).toEqual({ hours: 14, minutes: 0 });
      expect(parseClockTime('9')).toEqual({ hours: 9, minutes: 0 });
    });

    it('解析点号分隔', () => {
      expect(parseClockTime('14.30')).toEqual({ hours: 14, minutes: 30 });
    });

    it('解析横线分隔', () => {
      expect(parseClockTime('14-30')).toEqual({ hours: 14, minutes: 30 });
    });
  });

  describe('12小时制', () => {
    it('解析 PM 时间', () => {
      expect(parseClockTime('2:30pm')).toEqual({ hours: 14, minutes: 30 });
      expect(parseClockTime('2:30 PM')).toEqual({ hours: 14, minutes: 30 });
      expect(parseClockTime('12:00pm')).toEqual({ hours: 12, minutes: 0 });
    });

    it('解析 AM 时间', () => {
      expect(parseClockTime('9:30am')).toEqual({ hours: 9, minutes: 30 });
      expect(parseClockTime('9:30 AM')).toEqual({ hours: 9, minutes: 30 });
      expect(parseClockTime('12:00am')).toEqual({ hours: 0, minutes: 0 });
    });

    it('解析简单 PM/AM', () => {
      expect(parseClockTime('2pm')).toEqual({ hours: 14, minutes: 0 });
      expect(parseClockTime('9am')).toEqual({ hours: 9, minutes: 0 });
    });

    it('解析带数字的 PM/AM', () => {
      expect(parseClockTime('230pm')).toEqual({ hours: 14, minutes: 30 });
    });
  });

  describe('中文格式', () => {
    it('解析下午时间', () => {
      expect(parseClockTime('下午2:30')).toEqual({ hours: 14, minutes: 30 });
      expect(parseClockTime('下午2')).toEqual({ hours: 14, minutes: 0 });
    });

    it('解析上午时间', () => {
      expect(parseClockTime('上午9:30')).toEqual({ hours: 9, minutes: 30 });
      expect(parseClockTime('上午9')).toEqual({ hours: 9, minutes: 0 });
    });

    it('解析晚上时间', () => {
      expect(parseClockTime('晚上8:00')).toEqual({ hours: 20, minutes: 0 });
    });

    it('解析凌晨时间', () => {
      expect(parseClockTime('凌晨2:00')).toEqual({ hours: 2, minutes: 0 });
    });
  });

  describe('无效输入', () => {
    it('超出范围返回 null', () => {
      expect(parseClockTime('25:00')).toBeNull();
      expect(parseClockTime('24:00')).toBeNull();
      expect(parseClockTime('12:60')).toBeNull();
    });

    it('无效格式返回 null', () => {
      expect(parseClockTime('invalid')).toBeNull();
      expect(parseClockTime('abc')).toBeNull();
    });

    it('空字符串返回 null', () => {
      expect(parseClockTime('')).toBeNull();
    });

    it('null/undefined 返回 null', () => {
      expect(parseClockTime(null as unknown as string)).toBeNull();
      expect(parseClockTime(undefined as unknown as string)).toBeNull();
    });
  });

  describe('边界条件', () => {
    it('午夜', () => {
      expect(parseClockTime('0:00')).toEqual({ hours: 0, minutes: 0 });
      expect(parseClockTime('00:00')).toEqual({ hours: 0, minutes: 0 });
    });

    it('中午', () => {
      expect(parseClockTime('12:00')).toEqual({ hours: 12, minutes: 0 });
    });

    it('最后一分钟', () => {
      expect(parseClockTime('23:59')).toEqual({ hours: 23, minutes: 59 });
    });
  });
});

describe('formatClockTime', () => {
  describe('24小时制', () => {
    it('格式化基本时间', () => {
      expect(formatClockTime(870)).toBe('14:30');
      expect(formatClockTime(545)).toBe('9:05');
    });

    it('格式化午夜', () => {
      expect(formatClockTime(0)).toBe('0:00');
    });

    it('格式化中午', () => {
      expect(formatClockTime(720)).toBe('12:00');
    });

    it('格式化最后一分钟', () => {
      expect(formatClockTime(1439)).toBe('23:59');
    });
  });

  describe('12小时制', () => {
    it('格式化下午时间', () => {
      expect(formatClockTime(870, false)).toBe('2:30 PM');
      expect(formatClockTime(720, false)).toBe('12:00 PM');
    });

    it('格式化上午时间', () => {
      expect(formatClockTime(545, false)).toBe('9:05 AM');
    });

    it('格式化午夜', () => {
      expect(formatClockTime(0, false)).toBe('12:00 AM');
    });
  });

  describe('归一化', () => {
    it('超出范围的值被归一化', () => {
      expect(formatClockTime(1440)).toBe('0:00'); // 24:00 -> 0:00
      expect(formatClockTime(1500)).toBe('1:00'); // 25:00 -> 1:00
    });

    it('负值被归一化', () => {
      expect(formatClockTime(-60)).toBe('23:00'); // -1:00 -> 23:00
    });
  });
});

describe('clockTimeToMinutes', () => {
  it('转换基本时间', () => {
    expect(clockTimeToMinutes({ hours: 14, minutes: 30 })).toBe(870);
    expect(clockTimeToMinutes({ hours: 0, minutes: 0 })).toBe(0);
    expect(clockTimeToMinutes({ hours: 23, minutes: 59 })).toBe(1439);
  });
});

describe('minutesToClockTime', () => {
  it('转换基本分钟数', () => {
    expect(minutesToClockTime(870)).toEqual({ hours: 14, minutes: 30 });
    expect(minutesToClockTime(0)).toEqual({ hours: 0, minutes: 0 });
    expect(minutesToClockTime(1439)).toEqual({ hours: 23, minutes: 59 });
  });

  it('归一化超出范围的值', () => {
    expect(minutesToClockTime(1440)).toEqual({ hours: 0, minutes: 0 });
    expect(minutesToClockTime(-60)).toEqual({ hours: 23, minutes: 0 });
  });
});

describe('往返一致性', () => {
  it('24小时制往返', () => {
    for (let minutes = 0; minutes < 1440; minutes += 60) {
      const formatted = formatClockTime(minutes);
      const parsed = parseClockTime(formatted);
      expect(parsed).not.toBeNull();
      expect(clockTimeToMinutes(parsed!)).toBe(minutes);
    }
  });

  it('12小时制往返', () => {
    const testMinutes = [0, 60, 720, 780, 1380];
    for (const minutes of testMinutes) {
      const formatted = formatClockTime(minutes, false);
      const parsed = parseClockTime(formatted);
      expect(parsed).not.toBeNull();
      expect(clockTimeToMinutes(parsed!)).toBe(minutes);
    }
  });

  it('ClockTime 和分钟数互转', () => {
    for (let minutes = 0; minutes < 1440; minutes += 30) {
      const clockTime = minutesToClockTime(minutes);
      const backToMinutes = clockTimeToMinutes(clockTime);
      expect(backToMinutes).toBe(minutes);
    }
  });
});

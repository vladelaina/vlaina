import { describe, it, expect } from 'vitest';
import {
  parseClockTime,
  formatClockTime,
  clockTimeToMinutes,
  minutesToClockTime,
} from './clockTime';

describe('parseClockTime', () => {
  describe('24-hour format', () => {
    it('parses HH:MM format', () => {
      expect(parseClockTime('14:30')).toEqual({ hours: 14, minutes: 30 });
      expect(parseClockTime('09:05')).toEqual({ hours: 9, minutes: 5 });
      expect(parseClockTime('0:00')).toEqual({ hours: 0, minutes: 0 });
      expect(parseClockTime('23:59')).toEqual({ hours: 23, minutes: 59 });
    });

    it('parses Chinese colon', () => {
      expect(parseClockTime('14：30')).toEqual({ hours: 14, minutes: 30 });
    });

    it('parses HHMM format', () => {
      expect(parseClockTime('1430')).toEqual({ hours: 14, minutes: 30 });
      expect(parseClockTime('0905')).toEqual({ hours: 9, minutes: 5 });
    });

    it('parses HMM format', () => {
      expect(parseClockTime('930')).toEqual({ hours: 9, minutes: 30 });
    });

    it('parses hour only', () => {
      expect(parseClockTime('14')).toEqual({ hours: 14, minutes: 0 });
      expect(parseClockTime('9')).toEqual({ hours: 9, minutes: 0 });
    });

    it('parses dot separator', () => {
      expect(parseClockTime('14.30')).toEqual({ hours: 14, minutes: 30 });
    });

    it('parses dash separator', () => {
      expect(parseClockTime('14-30')).toEqual({ hours: 14, minutes: 30 });
    });
  });

  describe('12-hour format', () => {
    it('parses PM time', () => {
      expect(parseClockTime('2:30pm')).toEqual({ hours: 14, minutes: 30 });
      expect(parseClockTime('2:30 PM')).toEqual({ hours: 14, minutes: 30 });
      expect(parseClockTime('12:00pm')).toEqual({ hours: 12, minutes: 0 });
    });

    it('parses AM time', () => {
      expect(parseClockTime('9:30am')).toEqual({ hours: 9, minutes: 30 });
      expect(parseClockTime('9:30 AM')).toEqual({ hours: 9, minutes: 30 });
      expect(parseClockTime('12:00am')).toEqual({ hours: 0, minutes: 0 });
    });

    it('parses simple PM/AM', () => {
      expect(parseClockTime('2pm')).toEqual({ hours: 14, minutes: 0 });
      expect(parseClockTime('9am')).toEqual({ hours: 9, minutes: 0 });
    });

    it('parses PM/AM with numbers', () => {
      expect(parseClockTime('230pm')).toEqual({ hours: 14, minutes: 30 });
    });
  });

  describe('Chinese format', () => {
    it('parses afternoon time', () => {
      expect(parseClockTime('下午2:30')).toEqual({ hours: 14, minutes: 30 });
      expect(parseClockTime('下午2')).toEqual({ hours: 14, minutes: 0 });
    });

    it('parses morning time', () => {
      expect(parseClockTime('上午9:30')).toEqual({ hours: 9, minutes: 30 });
      expect(parseClockTime('上午9')).toEqual({ hours: 9, minutes: 0 });
    });

    it('parses evening time', () => {
      expect(parseClockTime('晚上8:00')).toEqual({ hours: 20, minutes: 0 });
    });

    it('parses early morning time', () => {
      expect(parseClockTime('凌晨2:00')).toEqual({ hours: 2, minutes: 0 });
    });
  });

  describe('invalid input', () => {
    it('out of range returns null', () => {
      expect(parseClockTime('25:00')).toBeNull();
      expect(parseClockTime('24:00')).toBeNull();
      expect(parseClockTime('12:60')).toBeNull();
    });

    it('invalid format returns null', () => {
      expect(parseClockTime('invalid')).toBeNull();
      expect(parseClockTime('abc')).toBeNull();
    });

    it('empty string returns null', () => {
      expect(parseClockTime('')).toBeNull();
    });

    it('null/undefined returns null', () => {
      expect(parseClockTime(null as unknown as string)).toBeNull();
      expect(parseClockTime(undefined as unknown as string)).toBeNull();
    });
  });

  describe('boundary conditions', () => {
    it('midnight', () => {
      expect(parseClockTime('0:00')).toEqual({ hours: 0, minutes: 0 });
      expect(parseClockTime('00:00')).toEqual({ hours: 0, minutes: 0 });
    });

    it('noon', () => {
      expect(parseClockTime('12:00')).toEqual({ hours: 12, minutes: 0 });
    });

    it('last minute', () => {
      expect(parseClockTime('23:59')).toEqual({ hours: 23, minutes: 59 });
    });
  });
});

describe('formatClockTime', () => {
  describe('24-hour format', () => {
    it('formats basic time', () => {
      expect(formatClockTime(870)).toBe('14:30');
      expect(formatClockTime(545)).toBe('9:05');
    });

    it('formats midnight', () => {
      expect(formatClockTime(0)).toBe('0:00');
    });

    it('formats noon', () => {
      expect(formatClockTime(720)).toBe('12:00');
    });

    it('formats last minute', () => {
      expect(formatClockTime(1439)).toBe('23:59');
    });
  });

  describe('12-hour format', () => {
    it('formats afternoon time', () => {
      expect(formatClockTime(870, false)).toBe('2:30 PM');
      expect(formatClockTime(720, false)).toBe('12:00 PM');
    });

    it('formats morning time', () => {
      expect(formatClockTime(545, false)).toBe('9:05 AM');
    });

    it('formats midnight', () => {
      expect(formatClockTime(0, false)).toBe('12:00 AM');
    });
  });

  describe('normalization', () => {
    it('out of range values are normalized', () => {
      expect(formatClockTime(1440)).toBe('0:00'); // 24:00 -> 0:00
      expect(formatClockTime(1500)).toBe('1:00'); // 25:00 -> 1:00
    });

    it('negative values are normalized', () => {
      expect(formatClockTime(-60)).toBe('23:00'); // -1:00 -> 23:00
    });
  });
});

describe('clockTimeToMinutes', () => {
  it('converts basic time', () => {
    expect(clockTimeToMinutes({ hours: 14, minutes: 30 })).toBe(870);
    expect(clockTimeToMinutes({ hours: 0, minutes: 0 })).toBe(0);
    expect(clockTimeToMinutes({ hours: 23, minutes: 59 })).toBe(1439);
  });
});

describe('minutesToClockTime', () => {
  it('converts basic minutes', () => {
    expect(minutesToClockTime(870)).toEqual({ hours: 14, minutes: 30 });
    expect(minutesToClockTime(0)).toEqual({ hours: 0, minutes: 0 });
    expect(minutesToClockTime(1439)).toEqual({ hours: 23, minutes: 59 });
  });

  it('normalizes out of range values', () => {
    expect(minutesToClockTime(1440)).toEqual({ hours: 0, minutes: 0 });
    expect(minutesToClockTime(-60)).toEqual({ hours: 23, minutes: 0 });
  });
});

describe('round-trip consistency', () => {
  it('24-hour format round-trip', () => {
    for (let minutes = 0; minutes < 1440; minutes += 60) {
      const formatted = formatClockTime(minutes);
      const parsed = parseClockTime(formatted);
      expect(parsed).not.toBeNull();
      expect(clockTimeToMinutes(parsed!)).toBe(minutes);
    }
  });

  it('12-hour format round-trip', () => {
    const testMinutes = [0, 60, 720, 780, 1380];
    for (const minutes of testMinutes) {
      const formatted = formatClockTime(minutes, false);
      const parsed = parseClockTime(formatted);
      expect(parsed).not.toBeNull();
      expect(clockTimeToMinutes(parsed!)).toBe(minutes);
    }
  });

  it('ClockTime and minutes conversion', () => {
    for (let minutes = 0; minutes < 1440; minutes += 30) {
      const clockTime = minutesToClockTime(minutes);
      const backToMinutes = clockTimeToMinutes(clockTime);
      expect(backToMinutes).toBe(minutes);
    }
  });
});

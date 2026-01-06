import { describe, it, expect } from 'vitest';
import {
  parseDuration,
  formatDuration,
  formatDurationFull,
  extractDuration,
} from './duration';

describe('parseDuration', () => {
  describe('single unit', () => {
    it('parses hours', () => {
      expect(parseDuration('2h')).toBe(120);
      expect(parseDuration('1h')).toBe(60);
      expect(parseDuration('24h')).toBe(1440);
    });

    it('parses minutes', () => {
      expect(parseDuration('30m')).toBe(30);
      expect(parseDuration('45m')).toBe(45);
      expect(parseDuration('90m')).toBe(90);
    });

    it('parses seconds', () => {
      expect(parseDuration('60s')).toBe(1);
      expect(parseDuration('30s')).toBe(0.5);
      expect(parseDuration('45s')).toBe(0.75);
    });

    it('parses days', () => {
      expect(parseDuration('1d')).toBe(1440);
      expect(parseDuration('2d')).toBe(2880);
    });
  });

  describe('compound format', () => {
    it('parses hours+minutes', () => {
      expect(parseDuration('2h30m')).toBe(150);
      expect(parseDuration('1h45m')).toBe(105);
    });

    it('parses days+hours+minutes', () => {
      expect(parseDuration('1d2h30m')).toBe(1440 + 120 + 30);
    });

    it('parses full format', () => {
      expect(parseDuration('1d2h30m45s')).toBe(1440 + 120 + 30 + 0.75);
    });
  });

  describe('decimal support', () => {
    it('parses decimal hours', () => {
      expect(parseDuration('1.5h')).toBe(90);
      expect(parseDuration('0.5h')).toBe(30);
    });

    it('parses decimal days', () => {
      expect(parseDuration('0.5d')).toBe(720);
    });
  });

  describe('case insensitive', () => {
    it('uppercase units', () => {
      expect(parseDuration('2H30M')).toBe(150);
      expect(parseDuration('1D')).toBe(1440);
    });
  });

  describe('invalid input', () => {
    it('empty string returns undefined', () => {
      expect(parseDuration('')).toBeUndefined();
    });

    it('invalid format returns undefined', () => {
      expect(parseDuration('invalid')).toBeUndefined();
      expect(parseDuration('2hours')).toBeUndefined();
      expect(parseDuration('abc123')).toBeUndefined();
    });

    it('over 100 days returns undefined', () => {
      expect(parseDuration('101d')).toBeUndefined();
      expect(parseDuration('150d')).toBeUndefined();
    });

    it('negative numbers return undefined', () => {
      expect(parseDuration('-2h')).toBeUndefined();
    });

    it('null/undefined returns undefined', () => {
      expect(parseDuration(null as unknown as string)).toBeUndefined();
      expect(parseDuration(undefined as unknown as string)).toBeUndefined();
    });
  });

  describe('boundary conditions', () => {
    it('values close to 100 days', () => {
      expect(parseDuration('99d')).toBe(99 * 1440);
    });

    it('very small values', () => {
      expect(parseDuration('1s')).toBeCloseTo(1 / 60, 5);
    });
  });
});

describe('formatDuration', () => {
  describe('basic formatting', () => {
    it('formats minutes', () => {
      expect(formatDuration(45)).toBe('45m');
      expect(formatDuration(30)).toBe('30m');
    });

    it('formats hours', () => {
      expect(formatDuration(60)).toBe('1h');
      expect(formatDuration(120)).toBe('2h');
    });

    it('formats hours+minutes', () => {
      expect(formatDuration(90)).toBe('1h30m');
      expect(formatDuration(150)).toBe('2h30m');
    });
  });

  describe('options', () => {
    it('showDays option', () => {
      expect(formatDuration(1500, { showDays: true })).toBe('1d1h');
      expect(formatDuration(1440, { showDays: true })).toBe('1d');
    });

    it('showSeconds option', () => {
      expect(formatDuration(90.5, { showSeconds: true })).toBe('1h30m30s');
    });

    it('converts to hours when not showing days', () => {
      expect(formatDuration(1500)).toBe('25h');
      expect(formatDuration(1440)).toBe('24h');
    });
  });

  describe('invalid input', () => {
    it('negative numbers return 0m', () => {
      expect(formatDuration(-10)).toBe('0m');
    });

    it('NaN returns 0m', () => {
      expect(formatDuration(NaN)).toBe('0m');
    });

    it('Infinity returns 0m', () => {
      expect(formatDuration(Infinity)).toBe('0m');
    });
  });

  describe('boundary conditions', () => {
    it('0 returns 0m', () => {
      expect(formatDuration(0)).toBe('0m');
    });

    it('very large values are capped', () => {
      const result = formatDuration(200000);
      expect(result).toBeDefined();
    });
  });
});

describe('formatDurationFull', () => {
  it('includes all units', () => {
    expect(formatDurationFull(1500.5)).toBe('1d1h30s');
  });

  it('only shows non-zero units', () => {
    expect(formatDurationFull(90)).toBe('1h30m');
    expect(formatDurationFull(60)).toBe('1h');
    expect(formatDurationFull(30)).toBe('30m');
  });

  it('invalid input returns 0s', () => {
    expect(formatDurationFull(-10)).toBe('0s');
    expect(formatDurationFull(NaN)).toBe('0s');
  });
});

describe('extractDuration', () => {
  describe('successful extraction', () => {
    it('extracts trailing hours', () => {
      const result = extractDuration('Complete report 2h');
      expect(result.cleanContent).toBe('Complete report');
      expect(result.minutes).toBe(120);
    });

    it('extracts trailing compound duration', () => {
      const result = extractDuration('Meeting 1h30m');
      expect(result.cleanContent).toBe('Meeting');
      expect(result.minutes).toBe(90);
    });

    it('extracts trailing minutes', () => {
      const result = extractDuration('Quick task 30m');
      expect(result.cleanContent).toBe('Quick task');
      expect(result.minutes).toBe(30);
    });
  });

  describe('cases where extraction is skipped', () => {
    it('content without duration remains unchanged', () => {
      const result = extractDuration('Normal task');
      expect(result.cleanContent).toBe('Normal task');
      expect(result.minutes).toBeUndefined();
    });

    it('pure duration is not extracted (prevents empty content)', () => {
      const result = extractDuration('2h');
      expect(result.cleanContent).toBe('2h');
      expect(result.minutes).toBeUndefined();
    });

    it('duration in middle is not extracted', () => {
      const result = extractDuration('2h later meeting');
      expect(result.cleanContent).toBe('2h later meeting');
      expect(result.minutes).toBeUndefined();
    });
  });

  describe('boundary conditions', () => {
    it('empty string', () => {
      const result = extractDuration('');
      expect(result.cleanContent).toBe('');
      expect(result.minutes).toBeUndefined();
    });

    it('null/undefined', () => {
      expect(extractDuration(null as unknown as string).cleanContent).toBe('');
      expect(extractDuration(undefined as unknown as string).cleanContent).toBe('');
    });
  });
});

describe('round-trip consistency', () => {
  it('formatting then parsing should return similar values', () => {
    const testValues = [30, 60, 90, 120, 150, 1440, 2880];
    for (const minutes of testValues) {
      const formatted = formatDuration(minutes);
      const parsed = parseDuration(formatted);
      expect(parsed).toBe(minutes);
    }
  });

  it('round-trip consistency with seconds', () => {
    const testValues = [30.5, 60.25, 90.75];
    for (const minutes of testValues) {
      const formatted = formatDurationFull(minutes);
      const parsed = parseDuration(formatted);
      expect(parsed).toBeCloseTo(minutes, 1);
    }
  });
});

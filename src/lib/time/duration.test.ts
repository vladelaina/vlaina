import { describe, it, expect } from 'vitest';
import {
  parseDuration,
  formatDuration,
  formatDurationFull,
  extractDuration,
} from './duration';

describe('parseDuration', () => {
  describe('单一单位', () => {
    it('解析小时', () => {
      expect(parseDuration('2h')).toBe(120);
      expect(parseDuration('1h')).toBe(60);
      expect(parseDuration('24h')).toBe(1440);
    });

    it('解析分钟', () => {
      expect(parseDuration('30m')).toBe(30);
      expect(parseDuration('45m')).toBe(45);
      expect(parseDuration('90m')).toBe(90);
    });

    it('解析秒', () => {
      expect(parseDuration('60s')).toBe(1);
      expect(parseDuration('30s')).toBe(0.5);
      expect(parseDuration('45s')).toBe(0.75);
    });

    it('解析天', () => {
      expect(parseDuration('1d')).toBe(1440);
      expect(parseDuration('2d')).toBe(2880);
    });
  });

  describe('复合格式', () => {
    it('解析小时+分钟', () => {
      expect(parseDuration('2h30m')).toBe(150);
      expect(parseDuration('1h45m')).toBe(105);
    });

    it('解析天+小时+分钟', () => {
      expect(parseDuration('1d2h30m')).toBe(1440 + 120 + 30);
    });

    it('解析完整格式', () => {
      expect(parseDuration('1d2h30m45s')).toBe(1440 + 120 + 30 + 0.75);
    });
  });

  describe('小数支持', () => {
    it('解析小数小时', () => {
      expect(parseDuration('1.5h')).toBe(90);
      expect(parseDuration('0.5h')).toBe(30);
    });

    it('解析小数天', () => {
      expect(parseDuration('0.5d')).toBe(720);
    });
  });

  describe('大小写不敏感', () => {
    it('大写单位', () => {
      expect(parseDuration('2H30M')).toBe(150);
      expect(parseDuration('1D')).toBe(1440);
    });
  });

  describe('无效输入', () => {
    it('空字符串返回 undefined', () => {
      expect(parseDuration('')).toBeUndefined();
    });

    it('无效格式返回 undefined', () => {
      expect(parseDuration('invalid')).toBeUndefined();
      expect(parseDuration('2hours')).toBeUndefined();
      expect(parseDuration('abc123')).toBeUndefined();
    });

    it('超过100天返回 undefined', () => {
      expect(parseDuration('101d')).toBeUndefined();
      expect(parseDuration('150d')).toBeUndefined();
    });

    it('负数返回 undefined', () => {
      expect(parseDuration('-2h')).toBeUndefined();
    });

    it('null/undefined 返回 undefined', () => {
      expect(parseDuration(null as unknown as string)).toBeUndefined();
      expect(parseDuration(undefined as unknown as string)).toBeUndefined();
    });
  });

  describe('边界条件', () => {
    it('接近100天的值', () => {
      expect(parseDuration('99d')).toBe(99 * 1440);
    });

    it('非常小的值', () => {
      expect(parseDuration('1s')).toBeCloseTo(1 / 60, 5);
    });
  });
});

describe('formatDuration', () => {
  describe('基本格式化', () => {
    it('格式化分钟', () => {
      expect(formatDuration(45)).toBe('45m');
      expect(formatDuration(30)).toBe('30m');
    });

    it('格式化小时', () => {
      expect(formatDuration(60)).toBe('1h');
      expect(formatDuration(120)).toBe('2h');
    });

    it('格式化小时+分钟', () => {
      expect(formatDuration(90)).toBe('1h30m');
      expect(formatDuration(150)).toBe('2h30m');
    });
  });

  describe('选项', () => {
    it('showDays 选项', () => {
      expect(formatDuration(1500, { showDays: true })).toBe('1d1h');
      expect(formatDuration(1440, { showDays: true })).toBe('1d');
    });

    it('showSeconds 选项', () => {
      expect(formatDuration(90.5, { showSeconds: true })).toBe('1h30m30s');
    });

    it('不显示天数时转换为小时', () => {
      expect(formatDuration(1500)).toBe('25h');
      expect(formatDuration(1440)).toBe('24h');
    });
  });

  describe('无效输入', () => {
    it('负数返回 0m', () => {
      expect(formatDuration(-10)).toBe('0m');
    });

    it('NaN 返回 0m', () => {
      expect(formatDuration(NaN)).toBe('0m');
    });

    it('Infinity 返回 0m', () => {
      expect(formatDuration(Infinity)).toBe('0m');
    });
  });

  describe('边界条件', () => {
    it('0 返回 0m', () => {
      expect(formatDuration(0)).toBe('0m');
    });

    it('非常大的值被限制', () => {
      const result = formatDuration(200000);
      expect(result).toBeDefined();
    });
  });
});

describe('formatDurationFull', () => {
  it('包含所有单位', () => {
    expect(formatDurationFull(1500.5)).toBe('1d1h30s');
  });

  it('只显示非零单位', () => {
    expect(formatDurationFull(90)).toBe('1h30m');
    expect(formatDurationFull(60)).toBe('1h');
    expect(formatDurationFull(30)).toBe('30m');
  });

  it('无效输入返回 0s', () => {
    expect(formatDurationFull(-10)).toBe('0s');
    expect(formatDurationFull(NaN)).toBe('0s');
  });
});

describe('extractDuration', () => {
  describe('成功提取', () => {
    it('提取末尾的小时', () => {
      const result = extractDuration('完成报告 2h');
      expect(result.cleanContent).toBe('完成报告');
      expect(result.minutes).toBe(120);
    });

    it('提取末尾的复合时长', () => {
      const result = extractDuration('开会 1h30m');
      expect(result.cleanContent).toBe('开会');
      expect(result.minutes).toBe(90);
    });

    it('提取末尾的分钟', () => {
      const result = extractDuration('快速任务 30m');
      expect(result.cleanContent).toBe('快速任务');
      expect(result.minutes).toBe(30);
    });
  });

  describe('不提取的情况', () => {
    it('无时长内容保持不变', () => {
      const result = extractDuration('普通任务');
      expect(result.cleanContent).toBe('普通任务');
      expect(result.minutes).toBeUndefined();
    });

    it('纯时长不提取（防止内容为空）', () => {
      const result = extractDuration('2h');
      expect(result.cleanContent).toBe('2h');
      expect(result.minutes).toBeUndefined();
    });

    it('中间的时长不提取', () => {
      const result = extractDuration('2h 后开会');
      expect(result.cleanContent).toBe('2h 后开会');
      expect(result.minutes).toBeUndefined();
    });
  });

  describe('边界条件', () => {
    it('空字符串', () => {
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

describe('往返一致性', () => {
  it('格式化后再解析应该得到相近的值', () => {
    const testValues = [30, 60, 90, 120, 150, 1440, 2880];
    for (const minutes of testValues) {
      const formatted = formatDuration(minutes);
      const parsed = parseDuration(formatted);
      expect(parsed).toBe(minutes);
    }
  });

  it('带秒的往返一致性', () => {
    const testValues = [30.5, 60.25, 90.75];
    for (const minutes of testValues) {
      const formatted = formatDurationFull(minutes);
      const parsed = parseDuration(formatted);
      expect(parsed).toBeCloseTo(minutes, 1);
    }
  });
});

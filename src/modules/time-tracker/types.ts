// Time Tracker module types

export interface AppUsage {
  name: string;
  icon?: string;
  duration: number; // Seconds
}

export type TimeRange = 'day' | 'month' | 'year';
export type SourceType = 'app' | 'web';

export const timeRangeLabels: Record<TimeRange, string> = {
  day: '按天',
  month: '按月',
  year: '按年',
};

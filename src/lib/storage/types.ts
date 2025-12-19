/**
 * Storage Type Definitions
 */

// Time Tracker types
export interface AppUsageData {
  name: string;
  duration: number; // seconds
}

export interface DayTimeData {
  date: string;
  apps: AppUsageData[];
  websites: AppUsageData[];
}

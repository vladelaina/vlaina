// Unified Time System Module

export {
  SECONDS_PER_MINUTE,
  MINUTES_PER_HOUR,
  HOURS_PER_DAY,
  MINUTES_PER_DAY,
  DAYS_PER_WEEK,
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  MS_PER_WEEK,
} from './constants';

export {
  parseDuration,
  formatDuration,
  formatDurationFull,
  extractDuration,
  type DurationFormatOptions,
  type ExtractDurationResult,
} from './duration';

export {
  parseClockTime,
  formatClockTime,
  clockTimeToMinutes,
  minutesToClockTime,
  type ClockTime,
} from './clockTime';

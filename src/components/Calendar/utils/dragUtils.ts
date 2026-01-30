import { minutesToDisplayPosition } from './timeUtils';

interface CalculateTimesResult {
  actualStartMin: number;
  actualEndMin: number;
  startDate: Date;
  endDate: Date;
  isValid: boolean;
}

/**
 * Calculates normalized start/end times and dates for a drag operation.
 * Handles visual ordering (start vs end) and cross-day logic.
 * 
 * Used by both useDragToCreate (for final creation) and EventsLayer (for ghost rendering).
 */
export function calculateDragEventTimes(
  dragStartMin: number,
  dragEndMin: number,
  dayDate: Date,
  dayStartMinutes: number
): CalculateTimesResult {
  
  // 1. Determine visual order (Start vs End)
  // We compare visual positions because minutes wrap around at midnight (0).
  // e.g., 10:00 (600) vs 00:06 (6). Visually 00:06 is "later" (bottom) if day starts at 05:00.
  const startPos = minutesToDisplayPosition(dragStartMin, dayStartMinutes);
  const endPos = minutesToDisplayPosition(dragEndMin, dayStartMinutes);
  
  let actualStartMin, actualEndMin;
  if (startPos <= endPos) {
    actualStartMin = dragStartMin;
    actualEndMin = dragEndMin;
  } else {
    actualStartMin = dragEndMin;
    actualEndMin = dragStartMin;
  }

  // 2. Handle Cross-Day Logic
  const startBeforeDayStart = actualStartMin < dayStartMinutes;
  const endBeforeDayStart = actualEndMin < dayStartMinutes;

  // Invalid case: Spanning across day start boundary backwards?
  // Or simply a sanity check. Kept from original logic.
  if (startBeforeDayStart && !endBeforeDayStart) {
    return { 
        actualStartMin, actualEndMin, 
        startDate: new Date(dayDate), endDate: new Date(dayDate), 
        isValid: false 
    };
  }

  let startDate: Date, endDate: Date;

  // Start Date Calculation
  if (startBeforeDayStart) {
    startDate = new Date(dayDate);
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(Math.floor(actualStartMin / 60), actualStartMin % 60, 0, 0);
  } else {
    startDate = new Date(dayDate);
    startDate.setHours(Math.floor(actualStartMin / 60), actualStartMin % 60, 0, 0);
  }

  // End Date Calculation
  if (endBeforeDayStart) {
    endDate = new Date(dayDate);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(Math.floor(actualEndMin / 60), actualEndMin % 60, 0, 0);
  } else {
    endDate = new Date(dayDate);
    endDate.setHours(Math.floor(actualEndMin / 60), actualEndMin % 60, 0, 0);
  }

  return {
    actualStartMin,
    actualEndMin,
    startDate,
    endDate,
    isValid: true
  };
}
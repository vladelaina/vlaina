import { minutesToDisplayPosition } from './timeUtils';

interface CalculateTimesResult {
  actualStartMin: number;
  actualEndMin: number;
  startDate: Date;
  endDate: Date;
  isValid: boolean;
}

export function calculateDragEventTimes(
  dragStartMin: number,
  dragEndMin: number,
  dayDate: Date,
  dayStartMinutes: number
): CalculateTimesResult {
  
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

  const startBeforeDayStart = actualStartMin < dayStartMinutes;
  const endBeforeDayStart = actualEndMin < dayStartMinutes;

  if (startBeforeDayStart && !endBeforeDayStart) {
    return { 
        actualStartMin, actualEndMin, 
        startDate: new Date(dayDate), endDate: new Date(dayDate), 
        isValid: false 
    };
  }

  let startDate: Date, endDate: Date;

  if (startBeforeDayStart) {
    startDate = new Date(dayDate);
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(Math.floor(actualStartMin / 60), actualStartMin % 60, 0, 0);
  } else {
    startDate = new Date(dayDate);
    startDate.setHours(Math.floor(actualStartMin / 60), actualStartMin % 60, 0, 0);
  }

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
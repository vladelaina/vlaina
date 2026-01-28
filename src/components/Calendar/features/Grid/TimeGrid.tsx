/**
 * TimeGrid - Week view
 * 
 * Based on BaseTimeGrid, configured to display 7 days of the week
 */

import { useMemo } from 'react';
import { startOfWeek, addDays, startOfDay } from 'date-fns';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { BaseTimeGrid } from './BaseTimeGrid';

interface TimeGridProps {
  onToggle?: (id: string) => void;
}

export function TimeGrid({ onToggle }: TimeGridProps = {}) {
  const { selectedDate, dayCount = 7 } = useCalendarStore();

  const days = useMemo(() => {
    // If it's a standard week view (7 days), align to the start of the week
    // Otherwise, start from the selected date
    const startDate = dayCount === 7 
      ? startOfWeek(selectedDate, { weekStartsOn: 1 }) 
      : startOfDay(selectedDate);

    return Array.from({ length: dayCount }, (_, i) => addDays(startDate, i));
  }, [selectedDate, dayCount]);

  return <BaseTimeGrid days={days} onToggle={onToggle} />;
}

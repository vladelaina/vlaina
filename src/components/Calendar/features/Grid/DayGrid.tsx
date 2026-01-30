/**
 * DayGrid - Day view
 * 
 * Based on BaseTimeGrid, configured to display dayCount days
 */

import { useMemo } from 'react';
import { addDays } from 'date-fns';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { BaseTimeGrid } from './BaseTimeGrid';

interface DayGridProps {
  onToggle?: (id: string) => void;
}

export function DayGrid({ onToggle }: DayGridProps = {}) {
  const { selectedDate, dayCount } = useCalendarStore();

  const days = useMemo(() => {
    return Array.from({ length: dayCount }, (_, i) => addDays(selectedDate, i));
  }, [selectedDate, dayCount]);

  return <BaseTimeGrid days={days} onToggle={onToggle} />;
}
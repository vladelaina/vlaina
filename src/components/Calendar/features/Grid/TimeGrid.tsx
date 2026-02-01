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
    const startDate = dayCount === 7 
      ? startOfWeek(selectedDate, { weekStartsOn: 1 }) 
      : startOfDay(selectedDate);

    return Array.from({ length: dayCount }, (_, i) => addDays(startDate, i));
  }, [selectedDate, dayCount]);

  return <BaseTimeGrid days={days} onToggle={onToggle} />;
}
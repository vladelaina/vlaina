import { useCalendarStore } from '@/stores/useCalendarStore';

export function useEventPreview(eventId: string, eventColor?: string) {
  const { universalPreviewColor, universalPreviewTarget } = useCalendarStore();
  
  const isPreviewing = universalPreviewTarget === eventId;
  const displayColor = (isPreviewing && universalPreviewColor !== null && universalPreviewColor !== undefined)
    ? universalPreviewColor
    : eventColor;

  return { isPreviewing, displayColor };
}

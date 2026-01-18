import { useState, useRef, useEffect, useCallback } from 'react';
import { useCalendarStore, type NekoEvent } from '@/stores/useCalendarStore';
import { useUIStore } from '@/stores/uiSlice';
import type { ItemColor } from '@/lib/colors';

export function useEventForm(event: NekoEvent) {
    const { updateEvent, updateEventIcon, closeEditingEvent, calendars, deleteEvent } = useCalendarStore();
    const { setPreviewIcon, setPreviewColor } = useUIStore();

    const [localSummary, setLocalSummary] = useState(event.summary || '');
    const [showCalendarPicker, setShowCalendarPicker] = useState(false);
    const isNewEvent = useRef(!(event.summary || '').trim());
    const debouncedUpdateSummary = useRef<NodeJS.Timeout | undefined>(undefined);

    const currentCalendar = calendars.find(c => c.id === event.calendarId) || calendars[0];

    // Sync state when switching events
    useEffect(() => {
        setLocalSummary(event.summary || '');
        isNewEvent.current = !(event.summary || '').trim();
    }, [event.uid]); // Intentionally verify only on UID change

    // Helper to save immediately
    const saveSummary = useCallback((value: string) => {
        updateEvent(event.uid, { summary: value });
    }, [event.uid, updateEvent]);

    // Handle close / completion logic
    const handleClose = useCallback(() => {
        // Clear debounce
        if (debouncedUpdateSummary.current) {
            clearTimeout(debouncedUpdateSummary.current);
        }

        // Check final state
        if (!localSummary.trim()) {
            deleteEvent(event.uid);
        } else if (localSummary !== event.summary) {
            saveSummary(localSummary);
        }

        setPreviewIcon(null, null);
        setPreviewColor(null, null);
        closeEditingEvent();
    }, [event.uid, event.summary, localSummary, deleteEvent, closeEditingEvent, setPreviewIcon, setPreviewColor, saveSummary]);

    // Input handlers
    const handleSummaryChange = (newSummary: string) => {
        setLocalSummary(newSummary);

        // Clear previous
        if (debouncedUpdateSummary.current) {
            clearTimeout(debouncedUpdateSummary.current);
        }

        // Set new
        debouncedUpdateSummary.current = setTimeout(() => {
            saveSummary(newSummary);
        }, 500);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleClose();
        }
    };

    const handleIconHover = useCallback((icon: string | undefined | null) => {
        if (icon === null) {
            setPreviewIcon(null, null);
        } else {
            setPreviewIcon(event.uid, icon);
        }
    }, [event.uid, setPreviewIcon]);

    const handleColorHover = useCallback((color: ItemColor | null) => {
        if (color === null) {
            setPreviewColor(null, null);
        } else {
            setPreviewColor(event.uid, color);
        }
    }, [event.uid, setPreviewColor]);

    const handleCalendarChange = (calendarId: string) => {
        updateEvent(event.uid, { calendarId });
        setShowCalendarPicker(false);
    };

    const handleColorChange = (color: ItemColor) => {
        updateEvent(event.uid, { color });
    };

    const handleIconChange = (icon: string | undefined) => {
        if (icon) {
            updateEventIcon(event.uid, icon);
        }
    };


    return {
        localSummary,
        handleSummaryChange,
        handleKeyDown,
        handleClose,
        handleIconHover,
        handleColorHover,
        handleCalendarChange,
        handleColorChange,
        handleIconChange,
        showCalendarPicker,
        setShowCalendarPicker,
        currentCalendar,
        calendars,
        isNewEvent,
    };
}

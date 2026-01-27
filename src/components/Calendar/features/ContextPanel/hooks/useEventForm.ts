import { useState, useRef, useEffect, useCallback } from 'react';
import { useCalendarStore, type NekoEvent } from '@/stores/useCalendarStore';
import { useIconPreview } from '@/components/common/UniversalIconPicker/useIconPreview';
import { type ItemColor, COLOR_HEX } from '@/lib/colors';

export function useEventForm(event: NekoEvent) {
    const { updateEvent, closeEditingEvent, calendars, deleteEvent } = useCalendarStore();
    
    // Use unified preview hook
    const { handlePreview, handlePreviewColor, handlePreviewSize } = useIconPreview(event.uid);

    const [localSummary, setLocalSummary] = useState(event.summary || '');
    const [localIcon, setLocalIcon] = useState(event.icon || null);
    const [showCalendarPicker, setShowCalendarPicker] = useState(false);
    const isNewEvent = useRef(!(event.summary || '').trim());
    const debouncedUpdateSummary = useRef<NodeJS.Timeout | undefined>(undefined);

    const currentCalendar = calendars.find(c => c.id === event.calendarId) || calendars[0];

    // Sync state when switching events
    useEffect(() => {
        setLocalSummary(event.summary || '');
        setLocalIcon(event.icon || null);
        isNewEvent.current = !(event.summary || '').trim();
    }, [event.uid, event.summary, event.icon]); // Sync on changes

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

        handlePreview(null);
        handlePreviewColor(null);
        handlePreviewSize(null);
        closeEditingEvent();
    }, [event.uid, event.summary, localSummary, deleteEvent, closeEditingEvent, handlePreview, handlePreviewColor, handlePreviewSize, saveSummary]);

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
        // Allow Enter to be default (newline)
        // Only close on Escape if needed, but usually Global Hotkeys handle Esc?
        // Let's keep Esc here just in case the global one doesn't catch focus in textarea
        if (e.key === 'Escape') {
            e.preventDefault();
            handleClose();
        }
    };

    const handleCalendarChange = (calendarId: string) => {
        updateEvent(event.uid, { calendarId });
        setShowCalendarPicker(false);
    };

    const handleColorChange = (color: ItemColor) => {
        const updates: Partial<NekoEvent> = { color };

        // If current icon is a vector icon (icon:name:color), sync its color too
        if (localIcon && localIcon.startsWith('icon:')) {
            const parts = localIcon.split(':');
            if (parts.length >= 2) {
                const hex = COLOR_HEX[color];
                
                if (hex) {
                    const newIcon = `icon:${parts[1]}:${hex}`;
                    setLocalIcon(newIcon);
                    updates.icon = newIcon;
                }
            }
        }
        
        updateEvent(event.uid, updates);
    };

    const handleIconChange = (icon: string | null) => {
        setLocalIcon(icon);
        
        const updates: Partial<NekoEvent> = { icon: icon || undefined };

        // Check for color sync: if icon string contains a color (icon:name:hex), try to sync event color
        if (icon && icon.startsWith('icon:')) {
            const parts = icon.split(':');
            if (parts.length >= 3) {
                const hexColor = parts[2];
                // Reverse lookup color name from hex
                const colorEntry = Object.entries(COLOR_HEX).find(([_, hex]) => hex.toLowerCase() === hexColor.toLowerCase());
                if (colorEntry) {
                    const colorName = colorEntry[0] as ItemColor;
                    if (colorName !== event.color) {
                        updates.color = colorName;
                    }
                }
            }
        }

        updateEvent(event.uid, updates);
    };

    const handleIconSizeConfirm = (size: number) => {
        updateEvent(event.uid, { iconSize: size });
    };


    return {
        localSummary,
        localIcon,
        handleSummaryChange,
        handleKeyDown,
        handleClose,
        handleIconHover: handlePreview,
        handleColorHover: handlePreviewColor,
        handlePreviewSize,
        handleCalendarChange,
        handleColorChange,
        handleIconChange,
        handleIconSizeConfirm,
        showCalendarPicker,
        setShowCalendarPicker,
        currentCalendar,
        calendars,
        isNewEvent,
    };
}

import { useState } from 'react';

type PanelView = 'tasks' | 'progress';

interface UseTaskPanelStateResult {
    // View state
    panelView: PanelView;
    setPanelView: (view: PanelView) => void;

    // Search state
    showSearch: boolean;
    setShowSearch: (show: boolean) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;

    // Section expansion state
    scheduledExpanded: boolean;
    setScheduledExpanded: (expanded: boolean) => void;
    completedExpanded: boolean;
    setCompletedExpanded: (expanded: boolean) => void;

    // Group picker state
    showGroupPicker: boolean;
    setShowGroupPicker: (show: boolean) => void;

    // Completed menu state
    showCompletedMenu: boolean;
    setShowCompletedMenu: (show: boolean) => void;

    // SubTask modal state
    addingSubTaskFor: string | null;
    setAddingSubTaskFor: (taskId: string | null) => void;
    subTaskContent: string;
    setSubTaskContent: (content: string) => void;
}

/**
 * Custom hook for managing CalendarTaskPanel UI state
 * Extracted from CalendarTaskPanel for better separation of concerns
 */
export function useTaskPanelState(): UseTaskPanelStateResult {
    const [panelView, setPanelView] = useState<PanelView>('tasks');
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [scheduledExpanded, setScheduledExpanded] = useState(true);
    const [completedExpanded, setCompletedExpanded] = useState(false);
    const [showGroupPicker, setShowGroupPicker] = useState(false);
    const [showCompletedMenu, setShowCompletedMenu] = useState(false);
    const [addingSubTaskFor, setAddingSubTaskFor] = useState<string | null>(null);
    const [subTaskContent, setSubTaskContent] = useState('');

    return {
        panelView,
        setPanelView,
        showSearch,
        setShowSearch,
        searchQuery,
        setSearchQuery,
        scheduledExpanded,
        setScheduledExpanded,
        completedExpanded,
        setCompletedExpanded,
        showGroupPicker,
        setShowGroupPicker,
        showCompletedMenu,
        setShowCompletedMenu,
        addingSubTaskFor,
        setAddingSubTaskFor,
        subTaskContent,
        setSubTaskContent,
    };
}
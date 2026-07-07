import type { IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { MessageKey } from '@/lib/i18n';
import type { ImageFilenameFormat, ImageStorageMode } from '@/stores/uiSlice';
import {
    settingsPillDropdownContentClassName,
    settingsPillDropdownItemClassName,
} from '../styles';

interface StorageOption {
    id: ImageStorageMode;
}

export const storageOptions: StorageOption[] = [
    {
        id: 'subfolder',
    },
    {
        id: 'notesRootSubfolder',
    },
    {
        id: 'currentFolder',
    },
    {
        id: 'notesRoot',
    },
];

interface FilenameFormatOption {
    id: ImageFilenameFormat;
    labelKey: MessageKey;
    icon: IconName;
}

export const filenameFormatOptions: FilenameFormatOption[] = [
    {
        id: 'original',
        labelKey: 'settings.images.originalName',
        icon: 'file.image',
    },
    {
        id: 'sequence',
        labelKey: 'settings.images.numericSequence',
        icon: 'editor.listOrdered',
    },
    {
        id: 'timestamp',
        labelKey: 'settings.images.timestamp',
        icon: 'misc.clock',
    },
];

export const sidebarDropdownTriggerClassName =
    "group/sidebar-row flex min-h-[var(--vlaina-size-36px)] w-56 max-w-full min-w-0 items-center justify-between gap-2 rounded-xl bg-transparent px-3 py-1 text-[var(--vlaina-font-base)] font-medium leading-5 text-[var(--vlaina-sidebar-notes-text)] shadow-[var(--vlaina-shadow-none)] transition-[background-color,box-shadow,color] duration-[var(--vlaina-duration-150)] hover:bg-[var(--vlaina-sidebar-notes-row-hover)] hover:shadow-[var(--vlaina-shadow-sidebar-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vlaina-color-sidebar-focus-ring)] max-[420px]:w-full";

export const storageDropdownTriggerClassName =
    "w-full cursor-pointer";

export const imageDropdownContentClassName =
    cn(settingsPillDropdownContentClassName, "w-[var(--radix-dropdown-menu-trigger-width)] min-w-64 !animate-none");

export const imageDropdownItemClassName =
    cn(settingsPillDropdownItemClassName, "cursor-pointer items-center gap-2 leading-none");

export function getStorageDirectoryPreview(
    mode: ImageStorageMode,
    noteSubfolderName: string,
    notesRootSubfolderName: string,
    t: (key: MessageKey, values?: Record<string, string | number>) => string
) {
    switch (mode) {
        case 'notesRootSubfolder':
            return t('settings.images.directoryNotesRootSubfolder', { folder: notesRootSubfolderName || 'assets' });
        case 'subfolder':
            return t('settings.images.directoryNoteSubfolder', { folder: noteSubfolderName || 'assets' });
        case 'notesRoot':
            return t('settings.images.directoryNotesRootRoot');
        case 'currentFolder':
            return t('settings.images.directoryCurrentFolder');
    }
}

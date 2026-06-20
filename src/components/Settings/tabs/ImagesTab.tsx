import { useUIStore, type ImageFilenameFormat, type ImageStorageMode } from '@/stores/uiSlice';
import { Icon, IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { SettingsSectionHeader, SettingsItem } from '../components/SettingsControls';
import { SettingsTextInput } from '../components/SettingsFields';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { useI18n, type MessageKey } from '@/lib/i18n';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface StorageOption {
    id: ImageStorageMode;
    labelKey: MessageKey;
    descriptionKey: MessageKey;
}

const storageOptions: StorageOption[] = [
    {
        id: 'subfolder',
        labelKey: 'settings.images.noteSubfolder',
        descriptionKey: 'settings.images.noteSubfolderDescription',
    },
    {
        id: 'vaultSubfolder',
        labelKey: 'settings.images.vaultSubfolder',
        descriptionKey: 'settings.images.vaultSubfolderDescription',
    },
    {
        id: 'currentFolder',
        labelKey: 'settings.images.currentFolder',
        descriptionKey: 'settings.images.currentFolderDescription',
    },
    {
        id: 'vault',
        labelKey: 'settings.images.vaultRoot',
        descriptionKey: 'settings.images.vaultRootDescription',
    },
];

interface FilenameFormatOption {
    id: ImageFilenameFormat;
    labelKey: MessageKey;
    descriptionKey: MessageKey;
    icon: IconName;
}

const filenameFormatOptions: FilenameFormatOption[] = [
    {
        id: 'original',
        labelKey: 'settings.images.originalName',
        descriptionKey: 'settings.images.originalNameDescription',
        icon: 'file.image',
    },
    {
        id: 'sequence',
        labelKey: 'settings.images.numericSequence',
        descriptionKey: 'settings.images.numericSequenceDescription',
        icon: 'editor.listOrdered',
    },
    {
        id: 'timestamp',
        labelKey: 'settings.images.timestamp',
        descriptionKey: 'settings.images.timestampDescription',
        icon: 'misc.clock',
    },
];

function getStoragePreview(
    mode: ImageStorageMode,
    noteSubfolderName: string,
    vaultSubfolderName: string,
    t: (key: MessageKey, values?: Record<string, string | number>) => string
) {
    switch (mode) {
        case 'vaultSubfolder':
            return t('settings.images.previewVaultSubfolder', { folder: vaultSubfolderName || 'assets' });
        case 'subfolder':
            return t('settings.images.previewNoteSubfolder', { folder: noteSubfolderName || 'assets' });
        case 'vault':
            return t('settings.images.previewVaultRoot');
        case 'currentFolder':
            return t('settings.images.previewCurrentFolder');
    }
}

function getStorageOptionDescription(
    option: StorageOption,
    noteSubfolderName: string,
    vaultSubfolderName: string,
    t: (key: MessageKey, values?: Record<string, string | number>) => string
) {
    if (option.id === 'vaultSubfolder') {
        return t(option.descriptionKey, { folder: vaultSubfolderName || 'assets' });
    }

    if (option.id === 'subfolder') {
        return t(option.descriptionKey, { folder: noteSubfolderName || 'assets' });
    }

    return t(option.descriptionKey);
}

export function ImagesTab() {
    const { t } = useI18n();
    const imageStorageMode = useUIStore((s) => s.imageStorageMode);
    const imageSubfolderName = useUIStore((s) => s.imageSubfolderName);
    const imageVaultSubfolderName = useUIStore((s) => s.imageVaultSubfolderName);
    const setImageStorageMode = useUIStore((s) => s.setImageStorageMode);
    const setImageSubfolderName = useUIStore((s) => s.setImageSubfolderName);
    const setImageVaultSubfolderName = useUIStore((s) => s.setImageVaultSubfolderName);
    const resetImageStorageLocation = () => {
        setImageStorageMode('subfolder');
        setImageSubfolderName('assets');
        setImageVaultSubfolderName('assets');
    };
    const storagePreview = getStoragePreview(
        imageStorageMode,
        imageSubfolderName,
        imageVaultSubfolderName,
        t
    );

    return (
        <div className="w-full" data-settings-section="images">
            <SettingsSectionHeader>{t('settings.images.images')}</SettingsSectionHeader>

            <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2 px-2">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span className="text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-sidebar-notes-text-soft)]">
                        {t('settings.images.storageLocation')}
                    </span>
                    <button
                        type="button"
                        onClick={resetImageStorageLocation}
                        aria-label={t('common.reset')}
                        title={t('common.reset')}
                        className="inline-flex size-6 items-center justify-center rounded-full text-[var(--vlaina-sidebar-notes-text-soft)] transition-colors hover:bg-[var(--vlaina-hover)] hover:text-[var(--vlaina-sidebar-notes-text)]"
                    >
                        <Icon name="common.refresh" className="size-3.5" />
                    </button>
                </div>
                <code className="max-w-full truncate rounded-full bg-[var(--vlaina-bg-tertiary)] px-3 py-1 text-[var(--vlaina-font-11)] text-[var(--vlaina-sidebar-notes-text-soft)]">
                    {storagePreview}
                </code>
            </div>

            <div className="space-y-2">
                {storageOptions.map((option) => {
                    const isSelected = imageStorageMode === option.id;

                    return (
                    <button
                        type="button"
                        key={option.id}
                        data-settings-image-storage-mode={option.id}
                        data-selected={isSelected ? 'true' : undefined}
                        onClick={() => setImageStorageMode(option.id)}
                            className={cn(
                                "group relative flex w-full items-center gap-4 rounded-[var(--vlaina-radius-22px)] px-6 py-4 text-left transition-all duration-[var(--vlaina-duration-200)] border border-transparent",
                                isSelected
                                    ? "bg-[var(--vlaina-sidebar-row-selected-bg)]"
                                    : chatComposerPillSurfaceClass
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <div className={cn(
                                    "text-[var(--vlaina-font-sm)] font-semibold",
                                    isSelected ? "text-[var(--vlaina-sidebar-row-selected-text)]" : "text-[var(--vlaina-sidebar-notes-text)]"
                                )}>
                                    {t(option.labelKey)}
                                </div>
                                <div className={cn(
                                    "text-[var(--vlaina-font-xs)] mt-0.5",
                                    isSelected ? "text-[var(--vlaina-sidebar-row-selected-text-soft)]" : "text-[var(--vlaina-sidebar-notes-text-soft)]"
                                )}>
                                    {getStorageOptionDescription(
                                        option,
                                        imageSubfolderName,
                                        imageVaultSubfolderName,
                                        t
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {(imageStorageMode === 'vaultSubfolder' || imageStorageMode === 'subfolder') && (
                <div className="mt-6 space-y-4">
                    {imageStorageMode === 'vaultSubfolder' && (
                        <SettingsItem
                            title={t('settings.images.folderName')}
                            description={t('settings.images.folderNameDescription', { folder: imageVaultSubfolderName || 'assets' })}
                        >
                            <SettingsTextInput
                                type="text"
                                data-settings-control="image-vault-subfolder-name"
                                value={imageVaultSubfolderName}
                                onChange={(e) => setImageVaultSubfolderName(e.target.value)}
                                placeholder="assets"
                                className="w-48 max-[640px]:w-full"
                                inputClassName="h-9 px-4 rounded-xl text-[var(--vlaina-font-13)]"
                                shellClassName="rounded-xl shadow-[var(--vlaina-shadow-none)]"
                            />
                        </SettingsItem>
                    )}

                    {imageStorageMode === 'subfolder' && (
                        <SettingsItem
                            title={t('settings.images.subfolderName')}
                            description={t('settings.images.subfolderNameDescription', { folder: imageSubfolderName || 'assets' })}
                        >
                            <SettingsTextInput
                                type="text"
                                data-settings-control="image-subfolder-name"
                                value={imageSubfolderName}
                                onChange={(e) => setImageSubfolderName(e.target.value)}
                                placeholder="assets"
                                className="w-48 max-[640px]:w-full"
                                inputClassName="h-9 px-4 rounded-xl text-[var(--vlaina-font-13)]"
                                shellClassName="rounded-xl shadow-[var(--vlaina-shadow-none)]"
                            />
                        </SettingsItem>
                    )}
                </div>
            )}

            <SettingsItem
                title={t('settings.images.filenameFormat')}
                className="mt-8"
            >
                <FilenameFormatDropdown />
            </SettingsItem>
        </div>
    );
}

function FilenameFormatDropdown() {
    const { t } = useI18n();
    const imageFilenameFormat = useUIStore((s) => s.imageFilenameFormat);
    const setImageFilenameFormat = useUIStore((s) => s.setImageFilenameFormat);
    const selectedOption = filenameFormatOptions.find((option) => option.id === imageFilenameFormat)
        ?? filenameFormatOptions[0];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    data-settings-control="image-filename-format"
                    className={cn(
                        "group/sidebar-row flex min-h-[var(--vlaina-size-36px)] w-56 max-w-full min-w-0 items-center justify-between gap-2 rounded-xl bg-transparent px-3 py-1 text-[var(--vlaina-font-base)] font-medium leading-5 text-[var(--vlaina-sidebar-notes-text)] shadow-[var(--vlaina-shadow-none)] transition-[background-color,box-shadow,color] duration-[var(--vlaina-duration-150)] hover:bg-[var(--vlaina-sidebar-notes-row-hover)] hover:shadow-[var(--vlaina-shadow-sidebar-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vlaina-color-sidebar-focus-ring)] max-[420px]:w-full"
                    )}
                >
                    <span className="flex min-w-0 items-center gap-2">
                        <Icon name={selectedOption.icon} size="sm" className="shrink-0 text-[var(--vlaina-sidebar-notes-file-icon)]" />
                        <span className="truncate leading-5">{t(selectedOption.labelKey)}</span>
                    </span>
                    <Icon
                        name="nav.chevronDown"
                        size="sm"
                        className="shrink-0 text-[var(--vlaina-sidebar-notes-text-soft)] transition-colors group-hover/sidebar-row:text-[var(--vlaina-sidebar-notes-text)]"
                    />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="z-[var(--vlaina-z-120)] w-[var(--radix-dropdown-menu-trigger-width)] min-w-64 rounded-[var(--vlaina-radius-22px)] border border-[var(--vlaina-sidebar-notes-menu-border)] bg-[var(--vlaina-sidebar-notes-menu-bg)] p-1.5 shadow-[var(--vlaina-sidebar-notes-menu-shadow)]"
            >
                {filenameFormatOptions.map((option) => {
                    const isSelected = imageFilenameFormat === option.id;

                    return (
                        <DropdownMenuItem
                            key={option.id}
                            data-settings-image-filename-format={option.id}
                            data-selected={isSelected ? 'true' : undefined}
                            onSelect={() => setImageFilenameFormat(option.id)}
                            className={cn(
                                "flex min-h-[var(--vlaina-size-36px)] min-w-0 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[var(--vlaina-font-base)] font-medium leading-none text-[var(--vlaina-sidebar-notes-text)] outline-none transition-[background-color,box-shadow,color] duration-[var(--vlaina-duration-150)] hover:!bg-[var(--vlaina-sidebar-notes-row-hover)] hover:shadow-[var(--vlaina-shadow-sidebar-row-hover)] focus:!bg-[var(--vlaina-sidebar-notes-row-hover)] focus:text-[var(--vlaina-sidebar-notes-text)] data-[highlighted]:!bg-[var(--vlaina-sidebar-notes-row-hover)] data-[highlighted]:text-[var(--vlaina-sidebar-notes-text)] data-[highlighted]:shadow-[var(--vlaina-shadow-sidebar-row-hover)]",
                                isSelected
                                    ? "!bg-[var(--vlaina-sidebar-notes-row-active)] text-[var(--vlaina-sidebar-row-selected-text)] shadow-[var(--vlaina-shadow-none)] data-[highlighted]:!bg-[var(--vlaina-sidebar-notes-row-active)] data-[highlighted]:text-[var(--vlaina-sidebar-row-selected-text)]"
                                    : undefined
                            )}
                        >
                            <Icon
                                name={option.icon}
                                size="sm"
                                className={cn(
                                    "shrink-0 text-[var(--vlaina-sidebar-notes-file-icon)]",
                                    isSelected && "text-[var(--vlaina-sidebar-row-selected-text)]"
                                )}
                            />
                            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                                <span className="block w-full truncate leading-5">{t(option.labelKey)}</span>
                                <span className="block w-full truncate text-[var(--vlaina-font-11)] font-normal leading-4 text-[var(--vlaina-sidebar-notes-text-soft)]">
                                    {t(option.descriptionKey)}
                                </span>
                            </span>
                            {isSelected && (
                                <Icon name="common.check" size="sm" className="shrink-0 text-[var(--vlaina-sidebar-row-selected-text)]" />
                            )}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

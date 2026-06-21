import { useUIStore, type ImageFilenameFormat, type ImageStorageMode } from '@/stores/uiSlice';
import { Icon, IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
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
    icon: IconName;
}

const storageOptions: StorageOption[] = [
    {
        id: 'subfolder',
        labelKey: 'settings.images.noteSubfolder',
        descriptionKey: 'settings.images.noteSubfolderDescription',
        icon: 'file.folder',
    },
    {
        id: 'vaultSubfolder',
        labelKey: 'settings.images.vaultSubfolder',
        descriptionKey: 'settings.images.vaultSubfolderDescription',
        icon: 'file.folderOutput',
    },
    {
        id: 'currentFolder',
        labelKey: 'settings.images.currentFolder',
        descriptionKey: 'settings.images.currentFolderDescription',
        icon: 'file.folderOpen',
    },
    {
        id: 'vault',
        labelKey: 'settings.images.vaultRoot',
        descriptionKey: 'settings.images.vaultRootDescription',
        icon: 'file.folderOutline',
    },
];

interface FilenameFormatOption {
    id: ImageFilenameFormat;
    labelKey: MessageKey;
    icon: IconName;
}

const filenameFormatOptions: FilenameFormatOption[] = [
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

const sidebarDropdownTriggerClassName =
    "group/sidebar-row flex min-h-[var(--vlaina-size-36px)] w-56 max-w-full min-w-0 items-center justify-between gap-2 rounded-xl bg-transparent px-3 py-1 text-[var(--vlaina-font-base)] font-medium leading-5 text-[var(--vlaina-sidebar-notes-text)] shadow-[var(--vlaina-shadow-none)] transition-[background-color,box-shadow,color] duration-[var(--vlaina-duration-150)] hover:bg-[var(--vlaina-sidebar-notes-row-hover)] hover:shadow-[var(--vlaina-shadow-sidebar-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vlaina-color-sidebar-focus-ring)] max-[420px]:w-full";

const sidebarDropdownContentClassName =
    "z-[var(--vlaina-z-120)] w-[var(--radix-dropdown-menu-trigger-width)] min-w-64 rounded-[var(--vlaina-radius-22px)] border border-[var(--vlaina-sidebar-notes-menu-border)] bg-[var(--vlaina-sidebar-notes-menu-bg)] p-1.5 shadow-[var(--vlaina-sidebar-notes-menu-shadow)] !animate-none";

const sidebarDropdownItemBaseClassName =
    "flex min-h-[var(--vlaina-size-36px)] min-w-0 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[var(--vlaina-font-base)] font-medium leading-none text-[var(--vlaina-sidebar-notes-text)] outline-none transition-[background-color,box-shadow,color] duration-[var(--vlaina-duration-150)] hover:!bg-[var(--vlaina-sidebar-notes-row-hover)] hover:shadow-[var(--vlaina-shadow-sidebar-row-hover)] focus:!bg-[var(--vlaina-sidebar-notes-row-hover)] focus:text-[var(--vlaina-sidebar-notes-text)] data-[highlighted]:!bg-[var(--vlaina-sidebar-notes-row-hover)] data-[highlighted]:text-[var(--vlaina-sidebar-notes-text)] data-[highlighted]:shadow-[var(--vlaina-shadow-sidebar-row-hover)]";

const sidebarDropdownItemSelectedClassName =
    "!bg-[var(--vlaina-sidebar-notes-row-active)] text-[var(--vlaina-sidebar-row-selected-text)] shadow-[var(--vlaina-shadow-none)] data-[highlighted]:!bg-[var(--vlaina-sidebar-notes-row-active)] data-[highlighted]:text-[var(--vlaina-sidebar-row-selected-text)]";

const previewImageSuffix = '/image.png';

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

function stripPreviewImageSuffix(value: string) {
    return value.endsWith(previewImageSuffix)
        ? value.slice(0, -previewImageSuffix.length)
        : value;
}

function padTimestampPart(value: number) {
    return String(value).padStart(2, '0');
}

function formatTimestampFilename(date: Date) {
    return [
        date.getFullYear(),
        padTimestampPart(date.getMonth() + 1),
        padTimestampPart(date.getDate()),
    ].join('-')
        + '_'
        + [
            padTimestampPart(date.getHours()),
            padTimestampPart(date.getMinutes()),
            padTimestampPart(date.getSeconds()),
        ].join('-')
        + '.png';
}

function getFilenamePreview(format: ImageFilenameFormat) {
    switch (format) {
        case 'sequence':
            return '1.png';
        case 'timestamp':
            return formatTimestampFilename(new Date());
        case 'original':
            return 'image.png';
    }
}

export function ImagesTab() {
    const { t } = useI18n();
    const imageStorageMode = useUIStore((s) => s.imageStorageMode);
    const imageSubfolderName = useUIStore((s) => s.imageSubfolderName);
    const imageVaultSubfolderName = useUIStore((s) => s.imageVaultSubfolderName);
    const imageFilenameFormat = useUIStore((s) => s.imageFilenameFormat);
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
    const filenamePreview = getFilenamePreview(imageFilenameFormat);

    return (
        <div className="w-full" data-settings-section="images">
            <div className="mt-10 mb-4 px-2">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <h3 className="text-[var(--vlaina-font-sm)] font-bold text-[var(--vlaina-sidebar-notes-text-soft)] tracking-tight opacity-[var(--vlaina-opacity-80)]">
                            {t('settings.images.images')}
                        </h3>
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
                    <div className="min-w-0 max-w-full">
                        <StorageLocationPreview
                            mode={imageStorageMode}
                            noteSubfolderName={imageSubfolderName}
                            vaultSubfolderName={imageVaultSubfolderName}
                            storagePreview={storagePreview}
                            filenamePreview={filenamePreview}
                        />
                    </div>
                </div>
            </div>

            <div
                className={cn(
                    "mb-3 flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-[var(--vlaina-radius-22px)] px-6 py-4 max-[640px]:px-4",
                    chatComposerPillSurfaceClass
                )}
            >
                <div className="min-w-0 text-[var(--vlaina-font-sm)] font-semibold text-[var(--vlaina-sidebar-notes-text)]">
                    {t('settings.images.storageLocation')}
                </div>
                <div className="min-w-0 flex-shrink-0 max-[420px]:w-full">
                    <StorageLocationDropdown
                        noteSubfolderName={imageSubfolderName}
                        vaultSubfolderName={imageVaultSubfolderName}
                    />
                </div>
            </div>

            <div
                className={cn(
                    "mb-3 flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-[var(--vlaina-radius-22px)] px-6 py-4 max-[640px]:px-4",
                    chatComposerPillSurfaceClass
                )}
            >
                <div className="min-w-0 text-[var(--vlaina-font-sm)] font-semibold text-[var(--vlaina-sidebar-notes-text)]">
                    {t('settings.images.filenameFormat')}
                </div>
                <div className="min-w-0 flex-shrink-0 max-[420px]:w-full">
                    <FilenameFormatDropdown />
                </div>
            </div>
        </div>
    );
}

function StorageLocationPreview({
    mode,
    noteSubfolderName,
    vaultSubfolderName,
    storagePreview,
    filenamePreview,
}: {
    mode: ImageStorageMode;
    noteSubfolderName: string;
    vaultSubfolderName: string;
    storagePreview: string;
    filenamePreview: string;
}) {
    const { t } = useI18n();
    const setImageSubfolderName = useUIStore((s) => s.setImageSubfolderName);
    const setImageVaultSubfolderName = useUIStore((s) => s.setImageVaultSubfolderName);

    if (mode !== 'subfolder' && mode !== 'vaultSubfolder') {
        return (
            <code className="max-w-full truncate rounded-full bg-[var(--vlaina-bg-tertiary)] px-2.5 py-1 text-[var(--vlaina-font-11)] leading-4 text-[var(--vlaina-sidebar-notes-text-soft)]">
                {stripPreviewImageSuffix(storagePreview)}/{filenamePreview}
            </code>
        );
    }

    const isVaultSubfolder = mode === 'vaultSubfolder';
    const basePath = stripPreviewImageSuffix(t(
        isVaultSubfolder
            ? 'settings.images.previewVaultRoot'
            : 'settings.images.previewCurrentFolder'
    ));
    const folderName = isVaultSubfolder ? vaultSubfolderName : noteSubfolderName;
    const setFolderName = isVaultSubfolder ? setImageVaultSubfolderName : setImageSubfolderName;

    return (
        <code className="inline-flex max-w-full min-w-0 items-center rounded-full bg-[var(--vlaina-bg-tertiary)] px-2.5 py-1 text-[var(--vlaina-font-11)] leading-4 text-[var(--vlaina-sidebar-notes-text-soft)]">
            <span className="min-w-0 truncate">{basePath}/</span>
            <input
                type="text"
                data-settings-control={isVaultSubfolder ? 'image-vault-subfolder-name' : 'image-subfolder-name'}
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="assets"
                spellCheck={false}
                aria-label={t(isVaultSubfolder ? 'settings.images.folderName' : 'settings.images.subfolderName')}
                className="mx-0.5 h-5 min-w-12 max-w-24 rounded-md border-0 bg-transparent px-1 py-0 font-mono text-[var(--vlaina-font-11)] leading-4 text-[var(--vlaina-sidebar-notes-text)] outline-none transition-colors placeholder:text-[var(--vlaina-sidebar-notes-text-soft)] hover:bg-[var(--vlaina-sidebar-notes-row-hover)] focus:bg-[var(--vlaina-color-setting-field)] focus:ring-1 focus:ring-[var(--vlaina-color-sidebar-focus-ring)]"
                style={{ width: `${Math.max((folderName || 'assets').length, 6)}ch` }}
            />
            <span className="shrink-0">/{filenamePreview}</span>
        </code>
    );
}

function StorageLocationDropdown({
    noteSubfolderName,
    vaultSubfolderName,
}: {
    noteSubfolderName: string;
    vaultSubfolderName: string;
}) {
    const { t } = useI18n();
    const imageStorageMode = useUIStore((s) => s.imageStorageMode);
    const setImageStorageMode = useUIStore((s) => s.setImageStorageMode);
    const selectedOption = storageOptions.find((option) => option.id === imageStorageMode)
        ?? storageOptions[0];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    data-settings-control="image-storage-location"
                    className={cn(sidebarDropdownTriggerClassName)}
                >
                    <span className="flex min-w-0 items-center gap-2">
                        <Icon name={selectedOption.icon} size="sm" className="shrink-0 text-[var(--vlaina-sidebar-notes-folder-icon)]" />
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
                className={sidebarDropdownContentClassName}
            >
                {storageOptions.map((option) => {
                    const isSelected = imageStorageMode === option.id;

                    return (
                        <DropdownMenuItem
                            key={option.id}
                            data-settings-image-storage-mode={option.id}
                            data-selected={isSelected ? 'true' : undefined}
                            onSelect={() => setImageStorageMode(option.id)}
                            className={cn(
                                sidebarDropdownItemBaseClassName,
                                isSelected && sidebarDropdownItemSelectedClassName
                            )}
                        >
                            <Icon
                                name={option.icon}
                                size="sm"
                                className={cn(
                                    "shrink-0 text-[var(--vlaina-sidebar-notes-folder-icon)]",
                                    isSelected && "text-[var(--vlaina-sidebar-row-selected-text)]"
                                )}
                            />
                            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                                <span className="block w-full truncate leading-5">{t(option.labelKey)}</span>
                                <span className="block w-full truncate text-[var(--vlaina-font-11)] font-normal leading-4 text-[var(--vlaina-sidebar-notes-text-soft)]">
                                    {getStorageOptionDescription(
                                        option,
                                        noteSubfolderName,
                                        vaultSubfolderName,
                                        t
                                    )}
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
                    className={cn(sidebarDropdownTriggerClassName)}
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
                className={sidebarDropdownContentClassName}
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
                                sidebarDropdownItemBaseClassName,
                                isSelected && sidebarDropdownItemSelectedClassName
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
                            <span className="flex min-w-0 flex-1 items-center text-left">
                                <span className="block w-full truncate leading-5">{t(option.labelKey)}</span>
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

import { useUIStore, type ImageStorageMode } from '@/stores/uiSlice';
import { Icon, IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { SettingsSectionHeader, SettingsItem } from '../components/SettingsControls';
import { SettingsTextInput } from '../components/SettingsFields';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { useI18n, type MessageKey } from '@/lib/i18n';

interface StorageOption {
    id: ImageStorageMode;
    labelKey: MessageKey;
    descriptionKey: MessageKey;
    icon: IconName;
}

const storageOptions: StorageOption[] = [
    {
        id: 'vaultSubfolder',
        labelKey: 'settings.images.vaultSubfolder',
        descriptionKey: 'settings.images.vaultSubfolderDescription',
        icon: 'file.folder',
    },
    {
        id: 'subfolder',
        labelKey: 'settings.images.noteSubfolder',
        descriptionKey: 'settings.images.noteSubfolderDescription',
        icon: 'file.folderOpen',
    },
    {
        id: 'vault',
        labelKey: 'settings.images.vaultRoot',
        descriptionKey: 'settings.images.vaultRootDescription',
        icon: 'common.home',
    },
    {
        id: 'currentFolder',
        labelKey: 'settings.images.currentFolder',
        descriptionKey: 'settings.images.currentFolderDescription',
        icon: 'file.folderOpen',
    },
];

export function ImagesTab() {
    const { t } = useI18n();
    const imageStorageMode = useUIStore((s) => s.imageStorageMode);
    const imageSubfolderName = useUIStore((s) => s.imageSubfolderName);
    const imageVaultSubfolderName = useUIStore((s) => s.imageVaultSubfolderName);
    const setImageStorageMode = useUIStore((s) => s.setImageStorageMode);
    const setImageSubfolderName = useUIStore((s) => s.setImageSubfolderName);
    const setImageVaultSubfolderName = useUIStore((s) => s.setImageVaultSubfolderName);

    return (
        <div className="w-full">
            <SettingsSectionHeader>{t('settings.images.images')}</SettingsSectionHeader>

            <div className="mb-4 flex items-center justify-between px-2">
                <span className="text-[13px] font-medium text-[var(--notes-sidebar-text-soft)]">
                    {t('settings.images.storageLocation')}
                </span>
                <code className="rounded-full bg-zinc-100 dark:bg-white/5 px-3 py-1 text-[11px] text-[var(--notes-sidebar-text-soft)]">
                    {imageStorageMode === 'vault' && './image.png'}
                    {imageStorageMode === 'vaultSubfolder' && `./${imageVaultSubfolderName || 'assets'}/image.png`}
                    {imageStorageMode === 'currentFolder' && './image.png'}
                    {imageStorageMode === 'subfolder' && `./${imageSubfolderName || 'assets'}/image.png`}
                </code>
            </div>

            <div className="space-y-2">
                {storageOptions.map((option) => {
                    const isSelected = imageStorageMode === option.id;

                    return (
                        <button
                            type="button"
                            key={option.id}
                            onClick={() => setImageStorageMode(option.id)}
                            className={cn(
                                "group relative flex w-full items-center gap-4 rounded-[22px] px-6 py-4 text-left transition-all duration-200 border border-transparent",
                                isSelected
                                    ? "bg-[var(--sidebar-row-selected-bg)] dark:bg-[rgba(65,168,234,0.12)]"
                                    : chatComposerPillSurfaceClass
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <div className={cn(
                                    "text-[14px] font-semibold",
                                    isSelected ? "text-[var(--sidebar-row-selected-text)]" : "text-[var(--notes-sidebar-text)]"
                                )}>
                                    {t(option.labelKey)}
                                </div>
                                <div className={cn(
                                    "text-[12px] mt-0.5",
                                    isSelected ? "text-[var(--sidebar-row-selected-text)]/80" : "text-[var(--notes-sidebar-text-soft)]"
                                )}>
                                    {t(option.descriptionKey)}
                                </div>
                            </div>
                            
                            <Icon name={option.icon} className={cn(
                                "size-5 flex-shrink-0 transition-colors",
                                isSelected ? "text-[var(--sidebar-row-selected-text)]" : "text-[var(--notes-sidebar-text-soft)]"
                            )} />
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
                                value={imageVaultSubfolderName}
                                onChange={(e) => setImageVaultSubfolderName(e.target.value)}
                                placeholder="assets"
                                className="w-48"
                                inputClassName="h-9 px-4 rounded-xl text-[13px]"
                                shellClassName="rounded-xl shadow-none"
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
                                value={imageSubfolderName}
                                onChange={(e) => setImageSubfolderName(e.target.value)}
                                placeholder="assets"
                                className="w-48"
                                inputClassName="h-9 px-4 rounded-xl text-[13px]"
                                shellClassName="rounded-xl shadow-none"
                            />
                        </SettingsItem>
                    )}
                </div>
            )}

            <div className="mt-8 mb-4 px-2">
                <h3 className="text-[13px] font-medium text-[var(--notes-sidebar-text-soft)]">
                    {t('settings.images.filenameFormat')}
                </h3>
            </div>
            
            <div className="space-y-2">
                <FilenameFormatOption
                    id="original"
                    label={t('settings.images.originalName')}
                    description={t('settings.images.originalNameDescription')}
                    icon="common.tag"
                />
                <FilenameFormatOption
                    id="sequence"
                    label={t('settings.images.numericSequence')}
                    description={t('settings.images.numericSequenceDescription')}
                    icon="editor.listOrdered"
                />
                <FilenameFormatOption
                    id="timestamp"
                    label={t('settings.images.timestamp')}
                    description={t('settings.images.timestampDescription')}
                    icon="misc.clock"
                />
            </div>
        </div>
    );
}

function FilenameFormatOption({ id, label, description, icon }: { id: 'original' | 'timestamp' | 'sequence'; label: string; description: string; icon: IconName }) {
    const imageFilenameFormat = useUIStore((s) => s.imageFilenameFormat);
    const setImageFilenameFormat = useUIStore((s) => s.setImageFilenameFormat);
    const isSelected = imageFilenameFormat === id;

    return (
        <button
            type="button"
            onClick={() => setImageFilenameFormat(id)}
            className={cn(
                "group relative flex w-full items-center gap-4 rounded-[22px] px-6 py-4 text-left transition-all duration-200 border border-transparent",
                isSelected
                    ? "bg-[var(--sidebar-row-selected-bg)] dark:bg-[rgba(65,168,234,0.12)]"
                    : chatComposerPillSurfaceClass
            )}
        >
            <div className="flex-1 min-w-0">
                <div className={cn(
                    "text-[14px] font-semibold",
                    isSelected ? "text-[var(--sidebar-row-selected-text)]" : "text-[var(--notes-sidebar-text)]"
                )}>
                    {label}
                </div>
                <div className={cn(
                    "text-[12px] mt-0.5",
                    isSelected ? "text-[var(--sidebar-row-selected-text)]/80" : "text-[var(--notes-sidebar-text-soft)]"
                )}>
                    {description}
                </div>
            </div>

            <Icon name={icon} className={cn(
                "size-5 flex-shrink-0 transition-colors",
                isSelected ? "text-[var(--sidebar-row-selected-text)]" : "text-[var(--notes-sidebar-text-soft)]"
            )} />
        </button>
    );
}

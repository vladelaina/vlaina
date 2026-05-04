import { useUIStore, type ImageStorageMode } from '@/stores/uiSlice';
import { Icon, IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { SettingsSectionHeader } from '../components/SettingsControls';
import { SettingsTextInput } from '../components/SettingsFields';

interface StorageOption {
    id: ImageStorageMode;
    label: string;
    description: string;
    icon: IconName;
}

const storageOptions: StorageOption[] = [
    {
        id: 'vaultSubfolder',
        label: 'Vault Subfolder',
        description: 'Save to a specific folder in the vault root (e.g., assets/)',
        icon: 'file.folder',
    },
    {
        id: 'subfolder',
        label: 'Note Subfolder',
        description: 'Save to a subfolder in the current note\'s directory',
        icon: 'file.folderOpen',
    },
    {
        id: 'vault',
        label: 'Vault Root',
        description: 'Save images directly to the vault root directory',
        icon: 'common.home',
    },
    {
        id: 'currentFolder',
        label: 'Current Folder',
        description: 'Save to the same folder as the current note',
        icon: 'file.folderOpen',
    },
];

export function ImagesTab() {
    const imageStorageMode = useUIStore((s) => s.imageStorageMode);
    const imageSubfolderName = useUIStore((s) => s.imageSubfolderName);
    const imageVaultSubfolderName = useUIStore((s) => s.imageVaultSubfolderName);
    const setImageStorageMode = useUIStore((s) => s.setImageStorageMode);
    const setImageSubfolderName = useUIStore((s) => s.setImageSubfolderName);
    const setImageVaultSubfolderName = useUIStore((s) => s.setImageVaultSubfolderName);

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <SettingsSectionHeader>Images</SettingsSectionHeader>
                <div className="flex items-baseline gap-2">
                    <label className="text-[14px] font-medium text-[#111] dark:text-zinc-100">
                        Storage Location
                    </label>
                    <code className="text-[12px] text-zinc-400 dark:text-zinc-500">
                        {imageStorageMode === 'vault' && 'vault/image.png'}
                        {imageStorageMode === 'vaultSubfolder' && `vault/${imageVaultSubfolderName || 'assets'}/image.png`}
                        {imageStorageMode === 'currentFolder' && 'vault/notes/image.png'}
                        {imageStorageMode === 'subfolder' && `vault/notes/${imageSubfolderName || 'assets'}/image.png`}
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
                                    "w-full flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                                    isSelected
                                        ? "border-[var(--sidebar-row-selected-text)] bg-[var(--sidebar-row-selected-bg)] dark:bg-[rgba(65,168,234,0.14)]"
                                        : "border-zinc-200/90 bg-white hover:border-zinc-300 dark:border-white/10 dark:bg-[#202020] dark:hover:border-white/15"
                                )}
                            >
                                <div className={cn(
                                    "mt-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                    isSelected
                                        ? "border-[var(--sidebar-row-selected-text)] bg-[var(--sidebar-row-selected-text)]"
                                        : "border-zinc-300 dark:border-zinc-600"
                                )}>
                                    {isSelected && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                    )}
                                </div>

                                <Icon name={option.icon} className={cn(
                                    "size-[18px] flex-shrink-0 mt-0.5",
                                    isSelected ? "text-[var(--sidebar-row-selected-text)]" : "text-zinc-400"
                                )} />

                                <div className="flex-1 min-w-0">
                                    <div className={cn(
                                        "text-sm font-medium",
                                        isSelected ? "text-[var(--sidebar-row-selected-text)]" : "text-zinc-700 dark:text-zinc-300"
                                    )}>
                                        {option.label}
                                    </div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        {option.description}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {imageStorageMode === 'vaultSubfolder' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Folder Name
                    </label>
                    <SettingsTextInput
                        type="text"
                        value={imageVaultSubfolderName}
                        onChange={(e) => setImageVaultSubfolderName(e.target.value)}
                        placeholder="assets"
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Images will be saved to <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{imageVaultSubfolderName || 'assets'}/</code> in the vault root
                    </p>
                </div>
            )}

            {imageStorageMode === 'subfolder' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Subfolder Name
                    </label>
                    <SettingsTextInput
                        type="text"
                        value={imageSubfolderName}
                        onChange={(e) => setImageSubfolderName(e.target.value)}
                        placeholder="assets"
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Images will be saved to <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{imageSubfolderName || 'assets'}/</code> inside the current note's folder
                    </p>
                </div>
            )}
            <div className="space-y-3 pt-5 border-t border-zinc-100 dark:border-white/5">
                <label className="text-[14px] font-medium text-[#111] dark:text-zinc-100">
                    Filename Format
                </label>
                <div className="space-y-2">
                    <FilenameFormatOption
                        id="original"
                        label="Original Name"
                        description="Keep the original filename"
                        icon="common.tag"
                    />
                    <FilenameFormatOption
                        id="sequence"
                        label="Numeric Sequence"
                        description="Use sequential numbers (e.g., 1.png, 2.png)"
                        icon="editor.listOrdered"
                    />
                    <FilenameFormatOption
                        id="timestamp"
                        label="Timestamp"
                        description="Use date and time (e.g., 2024-01-21_14-30-52.png)"
                        icon="misc.clock"
                    />
                </div>
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
                "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left",
                isSelected
                    ? "border-[var(--sidebar-row-selected-text)] bg-[var(--sidebar-row-selected-bg)] dark:bg-[rgba(65,168,234,0.14)]"
                    : "border-zinc-200/90 bg-white hover:border-zinc-300 dark:border-white/10 dark:bg-[#202020] dark:hover:border-white/15"
            )}
        >
            <div className={cn(
                "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0",
                isSelected
                    ? "border-[var(--sidebar-row-selected-text)] bg-[var(--sidebar-row-selected-text)]"
                    : "border-zinc-300 dark:border-zinc-600"
            )}>
                {isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
            </div>
            <Icon name={icon} className={cn(
                "size-[18px] flex-shrink-0",
                isSelected ? "text-[var(--sidebar-row-selected-text)]" : "text-zinc-400"
            )} />
            <div className="flex-1 min-w-0">
                <div className={cn(
                    "text-sm font-medium",
                    isSelected ? "text-[var(--sidebar-row-selected-text)]" : "text-zinc-700 dark:text-zinc-300"
                )}>
                    {label}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {description}
                </div>
            </div>
        </button>
    );
}

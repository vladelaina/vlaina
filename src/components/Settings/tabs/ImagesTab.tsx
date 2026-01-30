import { useUIStore, type ImageStorageMode } from '@/stores/uiSlice';
import { MdHome, MdFolderOpen, MdAccountTree, MdCollections, MdEditCalendar, MdLabel, MdFormatListNumbered } from 'react-icons/md';
import { cn } from '@/lib/utils';

interface StorageOption {
    id: ImageStorageMode;
    label: string;
    description: string;
    icon: React.ElementType;
}

const storageOptions: StorageOption[] = [
    {
        id: 'vaultSubfolder',
        label: 'Vault Subfolder',
        description: 'Save to a specific folder in the vault root (e.g., assets/)',
        icon: MdCollections,
    },
    {
        id: 'subfolder',
        label: 'Note Subfolder',
        description: 'Save to a subfolder in the current note\'s directory',
        icon: MdAccountTree,
    },
    {
        id: 'vault',
        label: 'Vault Root',
        description: 'Save images directly to the vault root directory',
        icon: MdHome,
    },
    {
        id: 'currentFolder',
        label: 'Current Folder',
        description: 'Save to the same folder as the current note',
        icon: MdFolderOpen,
    },
];


/**
 * Images tab content - image storage settings
 */
export function ImagesTab() {
    const imageStorageMode = useUIStore((s) => s.imageStorageMode);
    const imageSubfolderName = useUIStore((s) => s.imageSubfolderName);
    const imageVaultSubfolderName = useUIStore((s) => s.imageVaultSubfolderName);
    const setImageStorageMode = useUIStore((s) => s.setImageStorageMode);
    const setImageSubfolderName = useUIStore((s) => s.setImageSubfolderName);
    const setImageVaultSubfolderName = useUIStore((s) => s.setImageVaultSubfolderName);

    return (
        <div className="space-y-6">

            {/* Storage Mode Selection */}
            <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                    <label className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        Storage Location
                    </label>
                    <code className="text-xs text-zinc-400 dark:text-zinc-500">
                        {imageStorageMode === 'vault' && 'vault/image.png'}
                        {imageStorageMode === 'vaultSubfolder' && `vault/${imageVaultSubfolderName || 'assets'}/image.png`}
                        {imageStorageMode === 'currentFolder' && 'vault/notes/image.png'}
                        {imageStorageMode === 'subfolder' && `vault/notes/${imageSubfolderName || 'assets'}/image.png`}
                    </code>
                </div>

                <div className="space-y-2">
                    {storageOptions.map((option) => {
                        const isSelected = imageStorageMode === option.id;
                        const Icon = option.icon;

                        return (
                            <button
                                key={option.id}
                                onClick={() => setImageStorageMode(option.id)}
                                className={cn(
                                    "w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left",
                                    isSelected
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-600"
                                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                                )}
                            >
                                {/* Radio Circle */}
                                <div className={cn(
                                    "mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                    isSelected
                                        ? "border-blue-500 bg-blue-500"
                                        : "border-zinc-300 dark:border-zinc-600"
                                )}>
                                    {isSelected && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                    )}
                                </div>

                                {/* Icon */}
                                <Icon className={cn(
                                    "size-5 flex-shrink-0 mt-0.5",
                                    isSelected ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"
                                )} />

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <div className={cn(
                                        "text-sm font-medium",
                                        isSelected ? "text-blue-700 dark:text-blue-300" : "text-zinc-700 dark:text-zinc-300"
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

            {/* Vault Subfolder Name Input */}
            {imageStorageMode === 'vaultSubfolder' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Folder Name
                    </label>
                    <input
                        type="text"
                        value={imageVaultSubfolderName}
                        onChange={(e) => setImageVaultSubfolderName(e.target.value)}
                        placeholder="assets"
                        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Images will be saved to <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{imageVaultSubfolderName || 'assets'}/</code> in the vault root
                    </p>
                </div>
            )}

            {/* Note Subfolder Name Input */}
            {imageStorageMode === 'subfolder' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Subfolder Name
                    </label>
                    <input
                        type="text"
                        value={imageSubfolderName}
                        onChange={(e) => setImageSubfolderName(e.target.value)}
                        placeholder="assets"
                        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Images will be saved to <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{imageSubfolderName || 'assets'}/</code> inside the current note's folder
                    </p>
                </div>
            )}


            {/* Filename Format Section */}
            <div className="space-y-3 pt-6 border-t border-zinc-200 dark:border-zinc-700">
                <label className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Filename Format
                </label>
                <div className="space-y-2">
                    <FilenameFormatOption
                        id="original"
                        label="Original Name"
                        description="Keep the original filename"
                        icon={MdLabel}
                    />
                    <FilenameFormatOption
                        id="sequence"
                        label="Numeric Sequence"
                        description="Use sequential numbers (e.g., 1.png, 2.png)"
                        icon={MdFormatListNumbered}
                    />
                    <FilenameFormatOption
                        id="timestamp"
                        label="Timestamp"
                        description="Use date and time (e.g., 2024-01-21_14-30-52.png)"
                        icon={MdEditCalendar}
                    />
                </div>
            </div>
        </div>
    );


    function FilenameFormatOption({ id, label, description, icon: Icon }: { id: 'original' | 'timestamp' | 'sequence'; label: string; description: string; icon: React.ElementType }) {
        const imageFilenameFormat = useUIStore((s) => s.imageFilenameFormat);
        const setImageFilenameFormat = useUIStore((s) => s.setImageFilenameFormat);
        const isSelected = imageFilenameFormat === id;

        return (
            <button
                onClick={() => setImageFilenameFormat(id)}
                className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left",
                    isSelected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-600"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                )}
            >
                <div className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    isSelected
                        ? "border-blue-500 bg-blue-500"
                        : "border-zinc-300 dark:border-zinc-600"
                )}>
                    {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                </div>
                <Icon className={cn(
                    "size-4 flex-shrink-0",
                    isSelected ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"
                )} />
                <div className="flex-1 min-w-0">
                    <div className={cn(
                        "text-sm font-medium",
                        isSelected ? "text-blue-700 dark:text-blue-300" : "text-zinc-700 dark:text-zinc-300"
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
}

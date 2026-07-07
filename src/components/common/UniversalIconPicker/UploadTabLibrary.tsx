import type { MouseEvent } from 'react';
import { AppIcon } from '@/components/common/AppIcon';
import { themeIconTokens } from '@/styles/themeTokens';
import type { CustomIcon } from './UploadTab';

interface UploadTabLibraryProps {
    customIcons: CustomIcon[];
    emptyLabel: string;
    imageLoader?: (src: string) => Promise<string>;
    allowLegacyImageScheme: boolean;
    onSelect: (url: string) => void;
    onPreview?: (url: string | null) => void;
    onContextMenu: (event: MouseEvent, icon: CustomIcon) => void;
}

export function UploadTabLibrary({
    customIcons,
    emptyLabel,
    imageLoader,
    allowLegacyImageScheme,
    onSelect,
    onPreview,
    onContextMenu,
}: UploadTabLibraryProps) {
    return (
        <div className="flex-1 overflow-y-auto app-scrollbar pr-1 grid grid-cols-7 gap-2 content-start pb-2">
            {customIcons.map((emoji) => (
                <div
                    key={emoji.id}
                    className="relative aspect-square flex items-center justify-center cursor-pointer transition-all active:scale-[var(--vlaina-scale-95)]"
                    onClick={() => onSelect(emoji.url)}
                    onContextMenu={(event) => onContextMenu(event, emoji)}
                    onMouseEnter={() => onPreview?.(emoji.url)}
                    onMouseLeave={() => onPreview?.(null)}
                >
                    <AppIcon
                        icon={emoji.url}
                        size={themeIconTokens.sizeUploadPreview}
                        className="w-full h-full object-contain"
                        imageLoader={imageLoader}
                        allowLegacyImageScheme={allowLegacyImageScheme}
                    />
                </div>
            ))}
            {customIcons.length === 0 && (
                <div className="col-span-7 py-8 text-center text-xs text-muted-foreground italic">
                    {emptyLabel}
                </div>
            )}
        </div>
    );
}

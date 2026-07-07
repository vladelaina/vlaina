import { useUIStore } from '@/stores/uiSlice';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { settingsPillDropdownItemSelectedClassName } from '../styles';
import {
    filenameFormatOptions,
    imageDropdownContentClassName,
    imageDropdownItemClassName,
    sidebarDropdownTriggerClassName,
} from './imagesTabOptions';

export function FilenameFormatDropdown() {
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
                className={imageDropdownContentClassName}
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
                                imageDropdownItemClassName,
                                isSelected && settingsPillDropdownItemSelectedClassName
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

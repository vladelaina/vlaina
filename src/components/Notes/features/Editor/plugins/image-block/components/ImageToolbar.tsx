import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/icon-button';

interface ImageToolbarProps {
    alignment: 'left' | 'center' | 'right';
    onAlign: (align: 'left' | 'center' | 'right') => void;
    onEdit: () => void;
    onCopy: () => boolean | Promise<boolean> | void | Promise<void>;
    onDownload: () => void;
    onDelete: () => void;
    isVisible: boolean;
}

export const ImageToolbar: React.FC<ImageToolbarProps> = ({
    alignment,
    onAlign,
    onEdit,
    onCopy,
    onDownload,
    onDelete,
    isVisible
}) => {
    const [copied, setCopied] = useState(false);
    const mountedRef = React.useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (copied) {
            const timer = setTimeout(() => setCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [copied]);

    const handleCopy = () => {
        void Promise.resolve(onCopy()).then((didCopy) => {
            if (mountedRef.current && didCopy !== false) {
                setCopied(true);
            }
        }, () => undefined);
    };

    return (
        <div className={cn(
            "absolute top-2 right-2 mt-0 z-[60] transition-all duration-200",
            "flex items-center bg-white dark:bg-[#1e1e1e] border border-black/5 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-1 gap-1",
            "transform origin-top-right",
            isVisible
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
        )}>
            <div className="flex items-center gap-0.5">
                <ToolbarButton
                    icon={<Icon size="md" name="editor.alignLeft" />}
                    onClick={() => onAlign('left')}
                    active={alignment === 'left'}
                />
                <ToolbarButton
                    icon={<Icon size="md" name="editor.alignCenter" />}
                    onClick={() => onAlign('center')}
                    active={alignment === 'center'}
                />
                <ToolbarButton
                    icon={<Icon size="md" name="editor.alignRight" />}
                    onClick={() => onAlign('right')}
                    active={alignment === 'right'}
                />
            </div>

            <div className="w-[1px] h-[18px] bg-gray-200 dark:bg-zinc-700 mx-1" />

            <div className="flex items-center gap-0.5">
                <ToolbarButton icon={<Icon size="md" name="editor.crop" />} onClick={onEdit} />
                <ToolbarButton
                    icon={copied ? <Icon size="md" name="common.check" /> : <Icon name="common.copy" />}
                    onClick={handleCopy}
                    success={copied}
                />
                <ToolbarButton icon={<Icon size="md" name="common.download" />} onClick={onDownload} />
            </div>

            <div className="w-[1px] h-[18px] bg-gray-200 dark:bg-zinc-700 mx-1" />

            <div className="flex items-center gap-0.5">
                <ToolbarButton icon={<Icon size="md" name="common.delete" />} onClick={onDelete} danger />
            </div>
        </div>
    );
};

function ToolbarButton({
    icon,
    onClick,
    danger,
    success,
    active
}: {
    icon: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
    success?: boolean;
    active?: boolean;
}) {
    return (
        <IconButton
            onClick={onClick}
            icon={icon}
            className={cn(
                active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400",
                danger && "hover:text-red-500",
                success && "text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300"
            )}
        />
    );
}

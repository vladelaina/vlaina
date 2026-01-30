import React, { useState, useEffect } from 'react';
import { MdFormatAlignLeft, MdFormatAlignCenter, MdFormatAlignRight, MdCrop, MdContentCopy, MdCheck, MdDownload, MdDelete } from 'react-icons/md';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/icon-button';

interface ImageToolbarProps {
    alignment: 'left' | 'center' | 'right';
    onAlign: (align: 'left' | 'center' | 'right') => void;
    onEdit: () => void;
    onCopy: () => void;
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

    useEffect(() => {
        if (copied) {
            const timer = setTimeout(() => setCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [copied]);

    const handleCopy = () => {
        onCopy();
        setCopied(true);
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
                    icon={<MdFormatAlignLeft className="size-[18px]" />} 
                    onClick={() => onAlign('left')} 
                    active={alignment === 'left'} 
                />
                <ToolbarButton 
                    icon={<MdFormatAlignCenter className="size-[18px]" />} 
                    onClick={() => onAlign('center')} 
                    active={alignment === 'center'} 
                />
                <ToolbarButton 
                    icon={<MdFormatAlignRight className="size-[18px]" />} 
                    onClick={() => onAlign('right')} 
                    active={alignment === 'right'} 
                />
            </div>
            
            <div className="w-[1px] h-[18px] bg-gray-200 dark:bg-zinc-700 mx-1" />
            
            <div className="flex items-center gap-0.5">
                <ToolbarButton icon={<MdCrop className="size-[18px]" />} onClick={onEdit} />
                <ToolbarButton 
                    icon={copied ? <MdCheck className="size-[18px]" /> : <MdContentCopy className="size-[18px]" />} 
                    onClick={handleCopy} 
                    success={copied}
                />
                <ToolbarButton icon={<MdDownload className="size-[18px]" />} onClick={onDownload} />
            </div>

            <div className="w-[1px] h-[18px] bg-gray-200 dark:bg-zinc-700 mx-1" />

            <div className="flex items-center gap-0.5">
                <ToolbarButton icon={<MdDelete className="size-[18px]" />} onClick={onDelete} danger />
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
    onClick: (e: React.MouseEvent) => void;
    danger?: boolean;
    success?: boolean;
    active?: boolean;
}) {
    // IconButton without tooltip prop to remove hover labels
    return (
        <IconButton
            onClick={() => onClick({ preventDefault: () => {}, stopPropagation: () => {} } as any)}
            icon={icon}
            className={cn(
                active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400",
                danger && "hover:text-red-500",
                success && "text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300"
            )}
        />
    );
}

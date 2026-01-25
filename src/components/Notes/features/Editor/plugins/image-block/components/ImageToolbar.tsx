import React from 'react';
import { AlignLeft, AlignCenter, AlignRight, Pencil, Copy, Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    return (
        <div className={cn(
            "absolute top-2 right-2 mt-0 z-[60] transition-all duration-200",
            "flex items-center gap-0.5 p-1 bg-[var(--neko-bg-primary)]/80 backdrop-blur-md border border-[var(--neko-border)] rounded-lg shadow-sm",
            "transform origin-top-right",
            isVisible 
                ? "opacity-100 scale-100 translate-y-0" 
                : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
        )}>
            <div className="flex items-center gap-0.5">
                <ToolbarButton 
                    icon={<AlignLeft size={16} />} 
                    onClick={() => onAlign('left')} 
                    label="Left" 
                    active={alignment === 'left'} 
                />
                <ToolbarButton 
                    icon={<AlignCenter size={16} />} 
                    onClick={() => onAlign('center')} 
                    label="Center" 
                    active={alignment === 'center'} 
                />
                <ToolbarButton 
                    icon={<AlignRight size={16} />} 
                    onClick={() => onAlign('right')} 
                    label="Right" 
                    active={alignment === 'right'} 
                />
            </div>
            <div className="w-px h-4 bg-[var(--neko-border)] mx-0.5" />
            <div className="flex items-center gap-0.5">
                <ToolbarButton icon={<Pencil size={16} />} onClick={onEdit} label="Edit" />
                <ToolbarButton icon={<Copy size={16} />} onClick={onCopy} label="Copy" />
                <ToolbarButton icon={<Download size={16} />} onClick={onDownload} label="Download" />
                <ToolbarButton icon={<Trash2 size={16} />} onClick={onDelete} label="Delete" danger />
            </div>
        </div>
    );
};

function ToolbarButton({ 
    icon, 
    onClick, 
    label, 
    danger, 
    active 
}: {
    icon: React.ReactNode;
    onClick: (e: React.MouseEvent) => void;
    label: string;
    danger?: boolean;
    active?: boolean;
}) {
    return (
        <button
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick(e);
            }}
            className={cn(
                "p-1.5 rounded-md hover:bg-[var(--neko-hover)] transition-all",
                "text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-primary)]",
                active && "bg-[var(--neko-accent-light)] text-[var(--neko-accent)]",
                danger && "hover:bg-red-50 text-red-400 hover:text-red-500"
            )}
            title={label}
        >
            {icon}
        </button>
    );
}

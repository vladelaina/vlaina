import React, { useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageCaptionProps {
    originalAlt: string;
    value: string;
    isEditing: boolean;
    isVisible: boolean;
    onChange: (val: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    onEditStart: () => void;
}

export const ImageCaption: React.FC<ImageCaptionProps> = ({
    originalAlt,
    value,
    isEditing,
    isVisible,
    onChange,
    onSubmit,
    onCancel,
    onEditStart
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Stop propagation to prevent editor from handling keys (e.g. Backspace deleting the node)
        e.stopPropagation();
        
        if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
    };

    const stopPropagation = (e: React.SyntheticEvent) => {
        e.stopPropagation();
    };

    const preventDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    return (
        <div className={cn(
            "absolute bottom-2 right-2 mb-0 max-w-[calc(100%-16px)] z-[60] transition-all duration-200 select-auto",
            "flex items-center gap-0.5 p-1 bg-[var(--neko-bg-primary)]/80 backdrop-blur-md border border-[var(--neko-border)] rounded-lg shadow-sm",
            isVisible 
                ? "opacity-100 scale-100 translate-y-0" 
                : "opacity-0 scale-95 translate-y-2 pointer-events-none"
        )}>
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onSubmit}
                    onKeyDown={handleKeyDown}
                    onKeyUp={stopPropagation}
                    onKeyPress={stopPropagation}
                    onMouseDown={stopPropagation}
                    onMouseUp={stopPropagation}
                    onClick={stopPropagation}
                    onFocus={stopPropagation}
                    onDragStart={preventDrag}
                    draggable={false}
                    className="bg-transparent text-[var(--neko-text-primary)] text-xs font-medium px-2 py-1.5 outline-none min-w-[120px] w-auto select-text cursor-text"
                    placeholder="Caption..."
                />
            ) : (
                <div
                    className={cn(
                        "text-xs font-medium px-2 py-1.5 cursor-pointer hover:text-[var(--neko-text-primary)] transition-colors flex items-center gap-1.5 min-h-[28px]",
                        !originalAlt ? "text-[var(--neko-text-tertiary)] italic" : "text-[var(--neko-text-secondary)]"
                    )}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onEditStart();
                    }}
                >
                    {!originalAlt && <Pencil size={12} className="opacity-70" />}
                    {originalAlt || "Caption"}
                </div>
            )}
        </div>
    );
};

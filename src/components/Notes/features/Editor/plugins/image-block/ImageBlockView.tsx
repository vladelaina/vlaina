import React, { useRef, useState, useEffect } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { Trash2, Copy, Download, AlignLeft, AlignCenter, AlignRight, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageEditorModal } from '../../components/ImageEditorModal';

interface ImageBlockProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

type Alignment = 'left' | 'center' | 'right';

export const ImageBlockView = ({ node, view, getPos }: ImageBlockProps) => {
    const [width, setWidth] = useState(node.attrs.width || '100%');
    const [alignment, setAlignment] = useState<Alignment>('center');
    const [isHovered, setIsHovered] = useState(false);
    const [isEditingCaption, setIsEditingCaption] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [captionInput, setCaptionInput] = useState(node.attrs.alt || '');

    const containerRef = useRef<HTMLDivElement>(null);
    const captionInputRef = useRef<HTMLInputElement>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        if (node.attrs.width) {
            setWidth(node.attrs.width);
        }
    }, [node.attrs.width]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditingCaption && captionInputRef.current) {
            captionInputRef.current.focus();
        }
    }, [isEditingCaption]);

    const handleMouseEnter = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = undefined;
        }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        if (isEditingCaption) return; // Don't hide if editing caption
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 300); // 300ms grace period to allow moving to external toolbar
    };

    const handleResizeStart = (direction: 'left' | 'right') => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startWidth = containerRef.current?.offsetWidth || 0;
        const parentWidth = containerRef.current?.parentElement?.offsetWidth || 1;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const delta = direction === 'right'
                ? moveEvent.clientX - startX
                : startX - moveEvent.clientX;

            const newWidthPx = startWidth + delta * 2;
            const newWidthPercent = Math.min(100, Math.max(10, (newWidthPx / parentWidth) * 100));
            setWidth(`${newWidthPercent}%`);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            const pos = getPos();
            if (pos === undefined) return;

            const tr = view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                width: width
            });
            view.dispatch(tr);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(node.attrs.src);
        } catch (err) {
            console.error('Failed to copy image', err);
        }
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const link = document.createElement('a');
        link.href = node.attrs.src;
        link.download = node.attrs.alt || 'image';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = getPos();
        if (pos === undefined) return;

        const tr = view.state.tr.delete(pos, pos + node.nodeSize);
        view.dispatch(tr);
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsEditorOpen(true);
    };

    const handleEditorSave = (newSrc: string) => {
        const pos = getPos();
        if (pos === undefined) return;

        const tr = view.state.tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            src: newSrc
        });
        view.dispatch(tr);
    };

    const handleCaptionClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsEditingCaption(true);
        setCaptionInput(node.attrs.alt || '');
    };

    const handleCaptionSubmit = () => {
        setIsEditingCaption(false);
        const pos = getPos();
        if (pos === undefined) return;

        if (captionInput !== node.attrs.alt) {
            const tr = view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                alt: captionInput
            });
            view.dispatch(tr);
        }
    };

    const handleCaptionKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCaptionSubmit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setIsEditingCaption(false);
            setCaptionInput(node.attrs.alt || '');
        }
    };

    const handleAlign = (align: Alignment) => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setAlignment(align);
    };

    const alignmentClasses = {
        left: 'mr-auto',
        center: 'mx-auto',
        right: 'ml-auto'
    };

    return (
        <div className="w-full flex my-6 group/image">
            <ImageEditorModal
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                imageSrc={node.attrs.src}
                onSave={handleEditorSave}
            />

            <div
                className={cn(
                    "relative select-none transition-all duration-200 ease-out",
                    alignmentClasses[alignment],
                    isHovered || isEditingCaption ? "z-10" : ""
                )}
                ref={containerRef}
                style={{ width: width, maxWidth: '100%', transition: 'width 0.1s ease-out' }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* Toolbar - Floating Outside Top Right */}
                <div
                    className={cn(
                        "absolute -top-10 right-0 z-20 transition-all duration-200 floating-toolbar-inner shadow-sm border border-[var(--neko-border)] bg-[var(--neko-bg-primary)] rounded-lg transform origin-bottom-right",
                        (isHovered || isEditingCaption) ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
                    )}
                >
                    {/* Alignment group */}
                    <div className="toolbar-group">
                        <ToolbarButton
                            icon={<AlignLeft size={16} />}
                            onClick={handleAlign('left')}
                            label="Left Align"
                            active={alignment === 'left'}
                        />
                        <ToolbarButton
                            icon={<AlignCenter size={16} />}
                            onClick={handleAlign('center')}
                            label="Center"
                            active={alignment === 'center'}
                        />
                        <ToolbarButton
                            icon={<AlignRight size={16} />}
                            onClick={handleAlign('right')}
                            label="Right Align"
                            active={alignment === 'right'}
                        />
                    </div>
                    <div className="toolbar-divider" />
                    {/* Actions group */}
                    <div className="toolbar-group">
                        <ToolbarButton icon={<Pencil size={16} />} onClick={handleEditClick} label="Edit Image" />
                        <ToolbarButton icon={<Copy size={16} />} onClick={handleCopy} label="Copy Link" />
                        <ToolbarButton icon={<Download size={16} />} onClick={handleDownload} label="Download" />
                        <ToolbarButton icon={<Trash2 size={16} />} onClick={handleDelete} label="Delete" danger />
                    </div>
                </div>

                {/* Image */}
                <img
                    src={node.attrs.src}
                    alt={node.attrs.alt}
                    className={cn(
                        "w-full h-auto rounded-xl shadow-sm border border-[var(--neko-border)] bg-[var(--neko-bg-secondary)] transition-all duration-200",
                        // Removed blue ring references
                    )}
                    draggable={false}
                />

                {/* Resize Handles - Only visible on hover */}
                <div className={cn(
                    "absolute inset-0 pointer-events-none transition-opacity duration-200",
                    isHovered ? "opacity-100" : "opacity-0"
                )}>
                    <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 -ml-3 h-12 w-1.5 cursor-ew-resize flex items-center justify-center group/handle hover:bg-[var(--neko-accent)] bg-[var(--neko-border)] rounded-full transition-all pointer-events-auto shadow-sm"
                        onMouseDown={handleResizeStart('left')}
                    />
                    <div
                        className="absolute right-0 top-1/2 -translate-y-1/2 -mr-3 h-12 w-1.5 cursor-ew-resize flex items-center justify-center group/handle hover:bg-[var(--neko-accent)] bg-[var(--neko-border)] rounded-full transition-all pointer-events-auto shadow-sm"
                        onMouseDown={handleResizeStart('right')}
                    />
                </div>

                {/* Caption/Alt - Floating Outside Bottom Right */}
                {(node.attrs.alt || isEditingCaption) && (
                    <div className={cn(
                        "absolute -bottom-8 right-0 max-w-full",
                        "transition-all duration-200 transform origin-top-right",
                        (isHovered || isEditingCaption) ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
                    )}>
                        {isEditingCaption ? (
                            <input
                                ref={captionInputRef}
                                type="text"
                                value={captionInput}
                                onChange={(e) => setCaptionInput(e.target.value)}
                                onBlur={handleCaptionSubmit}
                                onKeyDown={handleCaptionKeyDown} // Use KeyDown for handling Enter
                                className="bg-[var(--neko-bg-primary)] text-[var(--neko-text-primary)] text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm border border-[var(--neko-accent)] outline-none min-w-[200px]"
                                placeholder="Write a description..."
                            />
                        ) : (
                            <div className="bg-[var(--neko-bg-primary)] text-[var(--neko-text-secondary)] text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm border border-[var(--neko-border)] truncate cursor-pointer hover:text-[var(--neko-text-primary)]"
                                onClick={handleCaptionClick}
                            >
                                {node.attrs.alt}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

function ToolbarButton({ icon, onClick, label, danger, active }: {
    icon: React.ReactNode,
    onClick: (e: React.MouseEvent) => void,
    label: string,
    danger?: boolean,
    active?: boolean
}) {
    return (
        <button
            onClick={onClick}
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

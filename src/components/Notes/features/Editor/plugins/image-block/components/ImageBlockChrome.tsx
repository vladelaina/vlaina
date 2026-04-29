import { ImageToolbar } from './ImageToolbar';
import { ImageCaption } from './ImageCaption';
import type { Alignment } from '../types';

interface ImageBlockChromeProps {
    nodeAlt: string;
    captionInput: string;
    isEditingCaption: boolean;
    isHovered: boolean;
    isActive: boolean;
    isDragging: boolean;
    loadError: boolean;
    alignment: Alignment;
    onCaptionChange: (value: string) => void;
    onCaptionSubmit: () => void;
    onCaptionCancel: () => void;
    onCaptionEditStart: () => void;
    onAlign: (align: Alignment) => void | Promise<void>;
    onEdit: () => void | Promise<void>;
    onCopy: () => boolean | Promise<boolean> | void | Promise<void>;
    onDownload: () => void;
    onDelete: () => void;
}

export function ImageBlockChrome({
    nodeAlt,
    captionInput,
    isEditingCaption,
    isHovered,
    isActive,
    isDragging,
    loadError,
    alignment,
    onCaptionChange,
    onCaptionSubmit,
    onCaptionCancel,
    onCaptionEditStart,
    onAlign,
    onEdit,
    onCopy,
    onDownload,
    onDelete,
}: ImageBlockChromeProps) {
    const isChromeVisible = (isHovered || isEditingCaption) && !isActive && !isDragging;

    return (
        <>
            {isChromeVisible && !loadError && (
                <ImageCaption
                    originalAlt={nodeAlt}
                    value={captionInput}
                    isEditing={isEditingCaption}
                    isVisible={true}
                    onChange={onCaptionChange}
                    onSubmit={onCaptionSubmit}
                    onCancel={onCaptionCancel}
                    onEditStart={onCaptionEditStart}
                />
            )}

            <ImageToolbar
                alignment={alignment}
                onAlign={onAlign}
                onEdit={onEdit}
                onCopy={onCopy}
                onDownload={onDownload}
                onDelete={onDelete}
                isVisible={isChromeVisible}
            />
        </>
    );
}

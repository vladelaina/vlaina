import React, { useRef, useEffect } from 'react';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ImageCaptionProps {
    originalAlt: string;
    value: string;
    isEditing: boolean;
    isVisible: boolean;
    align?: 'left' | 'right';
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
    align = 'right',
    onChange,
    onSubmit,
    onCancel,
    onEditStart
}) => {
    const { t } = useI18n();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            const input = inputRef.current;
            const focusTimer = window.setTimeout(() => {
                input.focus();
                const len = input.value.length;
                input.setSelectionRange(len, len);
            }, 0);

            return () => {
                window.clearTimeout(focusTimer);
            };
        }
    }, [isEditing]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
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
            "absolute bottom-2 mb-0 max-w-[var(--vlaina-width-full-minus-16px)] z-[var(--vlaina-z-60)] transition-all duration-[var(--vlaina-duration-200)] select-auto",
            align === 'left' ? "left-2" : "right-2",
            "floating-toolbar-inner image-caption-toolbar !rounded-[var(--vlaina-radius-26px)]",
            chatComposerPillSurfaceClass,
            isVisible
                ? "opacity-[var(--vlaina-opacity-100)] scale-[var(--vlaina-scale-100)] translate-y-0"
                : "opacity-[var(--vlaina-opacity-0)] scale-[var(--vlaina-scale-95)] translate-y-2 pointer-events-none"
        )}
            data-no-editor-drag-box="true"
        >
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    spellCheck={false}
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
                    className="bg-transparent text-[var(--vlaina-font-13)] leading-6 text-[var(--vlaina-text-primary)] font-medium px-2 h-6 outline-none min-w-[var(--vlaina-size-120px)] w-auto select-text cursor-text placeholder:text-[var(--vlaina-text-tertiary)]"
                    placeholder={t('editor.captionPlaceholder')}
                />
            ) : (
                <button
                    type="button"
                    className={cn(
                        "toolbar-btn image-caption-btn",
                        !originalAlt ? "text-[var(--vlaina-text-tertiary)] italic" : "text-[var(--vlaina-text-secondary)]"
                    )}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onEditStart();
                    }}
                >
                    {!originalAlt && <Icon name="common.compose" size="md" className="opacity-[var(--vlaina-opacity-70)]" />}
                    {originalAlt || t('editor.caption')}
                </button>
            )}
        </div>
    );
};

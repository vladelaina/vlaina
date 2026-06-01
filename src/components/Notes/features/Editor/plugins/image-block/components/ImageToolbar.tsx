import React, { useState, useEffect } from 'react';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { themeUiFeedbackTokens } from '@/styles/themeTokens';

interface ImageToolbarProps {
    alignment: 'left' | 'center' | 'right';
    onAlign: (align: 'left' | 'center' | 'right') => void;
    onEdit: () => void;
    onCopy: () => boolean | Promise<boolean> | void | Promise<void>;
    onDownload: () => void;
    onDelete: () => void;
    isVisible: boolean;
    hideMediaActions?: boolean;
}

export const ImageToolbar: React.FC<ImageToolbarProps> = ({
    alignment,
    onAlign,
    onEdit,
    onCopy,
    onDownload,
    onDelete,
    isVisible,
    hideMediaActions = false,
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
            const timer = setTimeout(
                () => setCopied(false),
                themeUiFeedbackTokens.imageToolbarCopyFeedbackDurationMs
            );
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
            "absolute top-2 right-2 mt-0 z-[var(--vlaina-z-60)] transition-all duration-[var(--vlaina-duration-200)]",
            "floating-toolbar-inner image-toolbar !rounded-[var(--vlaina-radius-26px)]",
            chatComposerPillSurfaceClass,
            "transform origin-top-right",
            isVisible
                ? "opacity-[var(--vlaina-opacity-100)] scale-[var(--vlaina-scale-100)] translate-y-0"
                : "opacity-[var(--vlaina-opacity-0)] scale-[var(--vlaina-scale-95)] -translate-y-2 pointer-events-none"
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

            {!hideMediaActions ? (
                <>
                    <div className="toolbar-divider" />

                    <div className="flex items-center gap-0.5">
                        <ToolbarButton icon={<Icon size="md" name="editor.crop" />} onClick={onEdit} />
                        <ToolbarButton
                            icon={copied ? <Icon size="md" name="common.check" /> : <Icon size="md" name="common.copy" />}
                            onClick={handleCopy}
                            success={copied}
                        />
                        <ToolbarButton icon={<Icon size="md" name="common.download" />} onClick={onDownload} />
                    </div>
                </>
            ) : null}

            <div className="toolbar-divider" />

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
        <button
            onClick={onClick}
            className={cn(
                "toolbar-btn image-toolbar-btn",
                active && "active",
                danger && "hover:!text-[var(--vlaina-color-status-danger-fg)]",
                success && "active"
            )}
        >
            {icon}
        </button>
    );
}

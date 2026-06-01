import React from 'react';
import { themeImageResizeHandleTokens } from '@/styles/themeTokens';

interface InvisibleResizeHandlesProps {
    onResizeStart: (direction: 'left' | 'right' | 'top' | 'bottom' | 'bottom-left' | 'bottom-right') => (e: React.MouseEvent) => void;
    verticalEnabled?: boolean;
}

export const InvisibleResizeHandles: React.FC<InvisibleResizeHandlesProps> = ({ onResizeStart, verticalEnabled = false }) => {
    const baseStyle = "absolute z-[var(--vlaina-z-50)] transition-colors";
    const thickness = themeImageResizeHandleTokens.thickness;
    const offset = themeImageResizeHandleTokens.offset;

    const handleMouseDown = (direction: 'left' | 'right' | 'top' | 'bottom' | 'bottom-left' | 'bottom-right') => (e: React.MouseEvent) => {
        onResizeStart(direction)(e);
    };

    return (
        <>
            <div
                data-resize-handle="true"
                className={`${baseStyle} cursor-ew-resize`}
                style={{ left: offset, top: 0, bottom: 0, width: thickness }}
                onMouseDown={handleMouseDown('left')}
            />

            <div
                data-resize-handle="true"
                className={`${baseStyle} cursor-ew-resize`}
                style={{ right: offset, top: 0, bottom: 0, width: thickness }}
                onMouseDown={handleMouseDown('right')}
            />

            <div
                data-resize-handle="true"
                className={`${baseStyle} cursor-ns-resize`}
                style={{ bottom: offset, left: 0, right: 0, height: thickness }}
                onMouseDown={handleMouseDown('bottom')}
            />

            <div
                data-resize-handle="true"
                className={`${baseStyle} cursor-sw-resize`}
                style={{
                    bottom: offset,
                    left: offset,
                    width: themeImageResizeHandleTokens.cornerSize,
                    height: themeImageResizeHandleTokens.cornerSize,
                    zIndex: themeImageResizeHandleTokens.cornerZIndex,
                }}
                onMouseDown={handleMouseDown('bottom-left')}
            />

            <div
                data-resize-handle="true"
                className={`${baseStyle} cursor-se-resize`}
                style={{
                    bottom: offset,
                    right: offset,
                    width: themeImageResizeHandleTokens.cornerSize,
                    height: themeImageResizeHandleTokens.cornerSize,
                    zIndex: themeImageResizeHandleTokens.cornerZIndex,
                }}
                onMouseDown={handleMouseDown('bottom-right')}
            />

            {verticalEnabled && (
                <div
                    data-resize-handle="true"
                    className={`${baseStyle} cursor-ns-resize`}
                    style={{ top: offset, left: 0, right: 0, height: thickness }}
                    onMouseDown={handleMouseDown('top')}
                />
            )}
        </>
    );
};

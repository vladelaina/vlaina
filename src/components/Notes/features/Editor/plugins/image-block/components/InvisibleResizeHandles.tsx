import React from 'react';

interface InvisibleResizeHandlesProps {
    onResizeStart: (direction: 'left' | 'right' | 'top' | 'bottom' | 'bottom-left' | 'bottom-right') => (e: React.MouseEvent) => void;
    verticalEnabled?: boolean;
}

export const InvisibleResizeHandles: React.FC<InvisibleResizeHandlesProps> = ({ onResizeStart, verticalEnabled = false }) => {
    const baseStyle = "absolute z-50 transition-colors";
    const thickness = "12px";
    const offset = "-6px";

    const handleMouseDown = (direction: 'left' | 'right' | 'top' | 'bottom' | 'bottom-left' | 'bottom-right') => (e: React.MouseEvent) => {
        onResizeStart(direction)(e);
    };

    return (
        <>
            <div
                className={`${baseStyle} cursor-ew-resize`}
                style={{ left: offset, top: 0, bottom: 0, width: thickness }}
                onMouseDown={handleMouseDown('left')}
            />

            <div
                className={`${baseStyle} cursor-ew-resize`}
                style={{ right: offset, top: 0, bottom: 0, width: thickness }}
                onMouseDown={handleMouseDown('right')}
            />

            <div
                className={`${baseStyle} cursor-ns-resize`}
                style={{ bottom: offset, left: 0, right: 0, height: thickness }}
                onMouseDown={handleMouseDown('bottom')}
            />

            <div
                className={`${baseStyle} cursor-sw-resize`}
                style={{ bottom: offset, left: offset, width: '24px', height: '24px', zIndex: 51 }}
                onMouseDown={handleMouseDown('bottom-left')}
            />

            <div
                className={`${baseStyle} cursor-se-resize`}
                style={{ bottom: offset, right: offset, width: '24px', height: '24px', zIndex: 51 }}
                onMouseDown={handleMouseDown('bottom-right')}
            />

            {verticalEnabled && (
                <div
                    className={`${baseStyle} cursor-ns-resize`}
                    style={{ top: offset, left: 0, right: 0, height: thickness }}
                    onMouseDown={handleMouseDown('top')}
                />
            )}
        </>
    );
};

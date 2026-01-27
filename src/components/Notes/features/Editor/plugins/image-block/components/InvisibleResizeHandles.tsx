import React from 'react';

interface InvisibleResizeHandlesProps {
    onResizeStart: (direction: 'left' | 'right' | 'top' | 'bottom' | 'bottom-left' | 'bottom-right') => (e: React.MouseEvent) => void;
    verticalEnabled?: boolean; // Only enable vertical resize (crop) when explicitly allowed
}

export const InvisibleResizeHandles: React.FC<InvisibleResizeHandlesProps> = ({ onResizeStart, verticalEnabled = false }) => {
    // Shared styles for the invisible hitboxes
    const baseStyle = "absolute z-50 transition-colors";
    const thickness = "12px"; // Hitbox thickness
    const offset = "-6px"; // Center the hitbox on the edge

    const handleMouseDown = (direction: 'left' | 'right' | 'top' | 'bottom' | 'bottom-left' | 'bottom-right') => (e: React.MouseEvent) => {
        onResizeStart(direction)(e);
    };

    return (
        <>
            {/* Left Handle - Always enabled for Width Resize */}
            <div
                className={`${baseStyle} cursor-ew-resize`}
                style={{
                    left: offset,
                    top: 0,
                    bottom: 0,
                    width: thickness,
                }}
                onMouseDown={handleMouseDown('left')}
            />

            {/* Right Handle - Always enabled for Width Resize */}
            <div
                className={`${baseStyle} cursor-ew-resize`}
                style={{
                    right: offset,
                    top: 0,
                    bottom: 0,
                    width: thickness,
                }}
                onMouseDown={handleMouseDown('right')}
            />

            {/* Bottom Handle - Now ALWAYS enabled for quick cropping */}
            <div
                className={`${baseStyle} cursor-ns-resize`}
                style={{
                    bottom: offset,
                    left: 0,
                    right: 0,
                    height: thickness,
                }}
                onMouseDown={handleMouseDown('bottom')}
            />
            
            {/* Bottom-Left Corner Handle - Proportional Resize */}
            <div
                className={`${baseStyle} cursor-sw-resize`}
                style={{
                    bottom: offset,
                    left: offset,
                    width: '24px', // Larger hit area for corners
                    height: '24px',
                    zIndex: 51, // Higher priority than edges
                }}
                onMouseDown={handleMouseDown('bottom-left')}
            />

            {/* Bottom-Right Corner Handle - Proportional Resize */}
            <div
                className={`${baseStyle} cursor-se-resize`}
                style={{
                    bottom: offset,
                    right: offset,
                    width: '24px',
                    height: '24px',
                    zIndex: 51,
                }}
                onMouseDown={handleMouseDown('bottom-right')}
            />
            
            {/* Top Handle - Only enabled in Edit Mode */}
            {verticalEnabled && (
                <div
                    className={`${baseStyle} cursor-ns-resize`}
                    style={{
                        top: offset,
                        left: 0,
                        right: 0,
                        height: thickness,
                    }}
                    onMouseDown={handleMouseDown('top')}
                />
            )}
        </>
    );
};

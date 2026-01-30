import { cn } from '@/lib/utils';

/**
 * DeleteIcon - Custom SVG implementation of the Material Design Delete icon
 * matches the exact path from Google Fonts/Material Symbols
 */
export function DeleteIcon({ className, size }: { className?: string; size?: number | string }) {
    const style = size ? { width: size, height: size } : undefined;

    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 -960 960 960" 
            fill="currentColor"
            className={cn("shrink-0", className)}
            style={style}
            aria-hidden="true"
        >
            <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
        </svg>
    );
}
